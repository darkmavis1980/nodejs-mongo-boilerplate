'use strict';

const User = require('../models/users');
const config = require('config');
const secretKey = config.get('security.secret');
const Mailer = require('./mailer');
const Core = require('./core');
const moment = require('moment');
const validator = require('validator');
const jwt = require('jsonwebtoken');

/**
 * This class manages the Users module and it's a singleton class
 * @class
 */
class Users {

  /**
   * Generate the authentication token
   */
  generateAuthToken(user, securityToken) {

    securityToken = securityToken || user.getLastToken().token;

    const token = jwt.sign({
      email: Core.encode64(user.email),
      securityToken: securityToken,
      id: user._id
    }, secretKey, {
      expiresIn: '1d' //1 days
    });
    return token;
  }

  /**
   * Decode the authentication token
   */
  decodeAuthToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          return reject('Token expired or not valid');
        }
        User.findById(decoded.id, (err, user) => {
          if (err) {
            return reject('Token not valid for this user');
          } else {
            if (!user) {
              let encryptedEmail = Core.decode64(decoded.email);
              let decodedSecurityToken = decoded.securityToken;
              let userSecurityToken = user.getLastToken();
              if (!userSecurityToken || !userSecurityToken) {
                return reject('Token expired or invalid');
              } else {
                if (encryptedEmail === user.email && userSecurityToken.token === decodedSecurityToken) {
                  return resolve({
                    user, securityToken: decoded.securityToken
                  });
                } else {
                  return reject('Email do not match');
                }
              }
            } else {
              return reject('User not found');
            }
          }
        });
      });
    });
  }

  /**
   * Activate an user
   */
  activate(req, callback) {
    const token = req.body.token;
    if (!token) {
      return callback('No token has been passed', null);
    }
    this.decodeAuthToken(token).then((data) => {
      let user = data.user;
      user.active = true;
      user.tokens = user.markTokenAsUsed(data.securityToken);
      user.save((err) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, {
            success: true
          });
        }
      });
    }, (err) => {
      callback(err, null);
    });
  }

  /**
   * Log the last time a user logged in the system
   */
  logAuthentication(user) {
    user.last_login = Date.now();
    user.save();
    //UserLogger.log(user);
  }

  /**
   * Create a new user
   */
  newUser(req, callback) {
    //create a new instance of a user
    let user = new User();
    // set the user info
    user.firstname = req.body.firstname;
    user.lastname = req.body.lastname;
    user.email = req.body.email;
    user.company = req.body.company || '';
    user.username = req.body.email;
    user.password = req.body.password;
    user.active = req.body.active || false;
    user.is_admin = req.body.isAdmin || false;

    if ((!req.body.password || !req.body.conf_password) || (req.body.password !== req.body.conf_password)) {
      return callback('Passwords do not match', null);
    } // end if

    // save the user and check for errors
    user.save((err) => {
      if (err) {
        //duplicate entry
        if (err.code === 11000) {
          return callback('A user with that username already exists', null);
        } else {
          return callback(err, null);
        }
      } else {
        callback(null, user);
      }
    });
  }

  /**
   * Update the user details
   */
  patchUser(req, callback) {
    //we need to retrieve the user data
    User.findById(req.params.user_id, (err, user) => {
      if (err) {
        return callback({
          message: 'Could not find the user',
          error: err
        }, null);
      }
      // fields that should be removed in case somebody tries to pass them
      const ignoreFields = ['_id', 'username', 'tokens'];

      if ((!req.body.password || !req.body.conf_password) || (req.body.password !== req.body.conf_password)) {
        return callback('Passwords do not match', null);
      } else if (req.body.password === '') {
        ignoreFields.push('password');
      } // end if

      ignoreFields.forEach(field => {
        if (req.body[field]) {
          delete req.body[field];
        }
      });
      user = Object.assign(user, req.body);
      user.save(err => {
        if (err) {
          return callback({
            message: 'Could not save the user details',
            error: err
          });
        }
        return callback(null, user);
      });
    });
  }

  /**
   * Delete a user
   */
  deleteUser(req, callback) {
    User.deleteOne({
      _id: req.params.user_id
    }, (err, user) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, 'User deleted successfully');
      }
    });
  }

  /**
   * Registration method for new users
   */
  register(req, callback) {
    let that = this;
    let user = new User();
    if (!req.body.email && validator.isEmail(req.body.email)) {
      return callback('The email is not valid', null);
    } // end if
    user.firstname = validator.trim(req.body.firstname);
    if (!req.body.firstname) {
      return callback('Firstname Required', null);
    } // end if
    user.lastname = validator.trim(req.body.lastname);
    if (!req.body.lastname) {
      return callback('Lastname Required', null);
    } // end if
    user.username = req.body.email;
    user.email = req.body.email;
    user.company = req.body.company;

    let securityToken = user.generateToken();
    user.tokens = [{
      token: securityToken,
      expiry: moment().add(1, 'days')
    }];

    if (user.passwordTooShort(req.body.password)) {
      return callback('Password is too short, must be at least 12 characters long', null);
    } // end if
    if ((!req.body.password || !req.body.conf_password) || (req.body.password !== req.body.conf_password)) {
      return callback('Password do not match', null);
    } // end if
    user.password = req.body.password;

    // save the user and check for errors
    user.save((err) => {
      if (err) {
        //duplicate entry
        if (err.code === 11000) {
          return callback('A user with that email already exists', null);
        } else {
          return callback(err, null);
        } // end if
      } // end if
      that.sendActivationEmail(user);
      return callback(null, 'User created!');
    });
  }
  /**
   * Send the activation emails for newly created users
   */
  sendActivationEmail(user) {
    let that = this;
    let token = this.generateAuthToken(user);


    // Configure mailgen by setting a theme and your product info
    // let mailGenerator = new Mailgen({
    //   theme: 'salted',
    //   product: {
    //     // Appears in header & footer of e-mails
    //     name: 'ECETOC',
    //     link: 'https://metrics.cremeglobal.com/'
    //     // Optional logo
    //     // logo: 'https://mailgen.js/img/logo.png'
    //   }
    // });

    // // Prepare email contents
    // let email = {
    //   body: {
    //     name: user.firstname,
    //     intro: 'Hi, in order to activate your account on metrics.cremeglobal.com we need to check if you email is valid.',
    //     action: {
    //       instructions: 'Click the button below to activate your account',
    //       button: {
    //         color: 'green',
    //         text: 'Activate',
    //         link: 'http://' + config.get('server.domain') + '/activation/' + token
    //       }
    //     },
    //     outro: 'If you did not request to register to this site, no further action is required on your part.'
    //   }
    // };

    // // Generate an HTML email using mailgen
    // let emailBody = mailGenerator.generate(email);

    // // let message = '<p>Hi, in order to activate your account on minifigsarchiver.com we need to confirm your account, to do so please click on the link below:</p>\
    // //  <p><a href="http://'+config.domain+'/index.html#/activation/'+token+'">Activate your account</a></p>\
    // //  <p>Best Regards<br />The Minifigs Archiver Team</p>';
    // Mailer.sendMail({
    //   from: `Metrics Mailer < $ {
    //     config.get('mail.noReply')
    //   } > `,
    //   to: user.email,
    //   subject: 'Welcome to ECETOC',
    //   html: emailBody
    // });
  }
  /**
   * Find the user by its email and send the change password email
   */
  forgotPassword(req, callback) {
    let that = this;
    let email = req.body.email.trim();
    if (!validator.isEmail(email)) {
      return callback('Email is not valid', null);
    } // end if
    User.findOne({
      email: email
    }, (err, user) => {
      if (err) {
        callback(err, null);
      } else {
        if (user) {
          user.issueNewSecurityToken();
          // if we found a user, we send him an email
          // let token = that.generateAuthToken(user);

          // // Configure mailgen by setting a theme and your product info
          // let mailGenerator = new Mailgen({
          //   theme: 'salted',
          //   product: {
          //     // Appears in header & footer of e-mails
          //     name: 'ECETOC',
          //     link: 'https://metrics.cremeglobal.com/'
          //     // Optional logo
          //     // logo: 'https://mailgen.js/img/logo.png'
          //   }
          // });

          // // Prepare email contents
          // let email = {
          //   body: {
          //     name: user.firstname,
          //     intro: 'Hi, you received this email because you requested to reset your password account:',
          //     action: {
          //       instructions: 'Click here to reset your password',
          //       button: {
          //         color: 'green',
          //         text: 'Activate',
          //         link: `http: //${config.get('server.domain')}/reset-pwd/${token}`
          //       }
          //     },
          //     outro: [`If you haven 't request it, please ignore this email.`,`Best Regards`, `The Yavin Team`]
          //   }
          // };

          // // let message = `<p>Hi, you received this email because you requested to reset your password account:</p>\
          // //  <p><a href="http://${config.get('              server.domain ')}/reset-pwd/${token}">Click here to reset your password</a></p>\
          // //  <p>If you haven\'t request it, please ignore this email.</p>\
          // //  <p>Best Regards<br />The ECETOC Team</p>`;

          // // Generate an HTML email using mailgen
          // let emailBody = mailGenerator.generate(email);

          //  Mailer.sendMail({
          //    from: `Yavin Mailer<${config.get('mail.noReply ')}>`,
          //    to: req.body.email,
          //    subject: 'Yavin password reset ',
          //    html: emailBody
          //  });

          //  callback(null, {
          //    success: true,
          //    message: 'Email sent!'
          //  });
        } else {
          callback('The email passed does not exists ', null);
        }
      }
    });
  }

  /**
   * Reset the password for a specific user
   */
  resetPassword(req, callback){
    let that = this;
    let new_password = req.body.new_password;
    let conf_new_password = req.body.conf_new_password;
    const token = req.body.token;
    this.decodeAuthToken(token).then((data) => {
      let user = data.user;
      if((!new_password || !conf_new_password) || (new_password !== conf_new_password)){
        return callback('Password do not match ', null)
      }// end if
      user.password = new_password;
      user.tokens = user.markTokenAsUsed(data.securityToken);
      user.save((err, data) => {
        if(err){
          callback(err, null)
        } else {
          callback(null, data)
        }
      });
    }, (err) => {
      callback(err,null);
    });
  }

  /**
   * Get the user data
   * @alias getUserById
   */
  getUser(req, callback){
    const userId = req.params.id;
    getUserById(userId, callback);
  }
  /**
   * Get ther user data
   */
  getUserById(userId, callback){
    User.findById(userId, (err, user) => {
      callback(err, user);
    });
  }
  /**
   * Get the list of users that are active and admins
   */
  getAdmins(callback){
    let query = User.find({
      is_admin: true,
      active: true
    });
    query.exec((err, users) => {
      if(err){
        callback(err, null);
      } else {
        callback(null, users);
      }
    });
  }

  /**
   * Get the full list of users
   */
  getUsers(req, callback){
    const offset = 0;

    let limit = 20;
    let page = 1;
    if(req.query){
      limit = parseInt(req.query.limit) || 20;
      page = parseInt(req.query.page) || 1;
    }

    if(page){
      if(page > 1){
        offset = limit * (page - 1);
      }// end if
    }// end if

    let queryFilter = {};
    User.countDocuments(queryFilter, (err, count) => {
      if(err){
        callback(err, null);
      } else {
        let query = User.find(queryFilter);
        query.sort(' +email ');
        query.select(' -tokens ');
        if(limit && page){
          query.limit(limit);
          query.skip(offset);
        }// end if
        query.exec();
        query.then(list => {
          callback(null, {
            list: list,
            count: count,
            pages: Math.ceil(count/limit),
            limit: limit,
            page: page
          });
        }, err => {
          callback(err, null);
        });
      }// end if
    });
  }

  getMe(req, callback){
    User
      .findById(req.decoded.id, ' -tokens -last_login -registration_date')
      .exec((err, data) => {
      if(err){
        callback(err, null);
      } else {
        callback(null, data);
      }
    });
  }
};

module.exports = new Users();