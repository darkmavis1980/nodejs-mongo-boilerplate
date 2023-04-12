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
      jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
          return reject('Token expired or not valid');
        }
        try {
          const user = await User.findById(decoded.id);
          const encryptedEmail = Core.decode64(decoded.email);
          const decodedSecurityToken = decoded.securityToken;
          const userSecurityToken = user.getLastToken();
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
        } catch (error) {
          reject('Token not valid for this user or user does not exists');
        }
      });
    });
  }

  /**
   * Activate an user
   */
  async activate(req) {
    try {
      const token = req.body.token;
      if (!token) {
        throw new Error('No token has been passed');
      }
      const data = await this.decodeAuthToken(token)
      const { user } = data;
      user.active = true;
      user.tokens = user.markTokenAsUsed(data.securityToken);
      await user.save();
      return {
        success: true
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Log the last time a user logged in the system
   */
  async logAuthentication(user) {
    user.last_login = Date.now();
    await user.save();
    //UserLogger.log(user);
  }

  /**
   * Create a new user
   */
  async newUser(req) {
    try {
      //create a new instance of a user
      const user = new User();
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
        throw new Error('Passwords do not match');
      } // end if

      // save the user and check for errors
      const data = await user.save();
      delete data.password;
      return data;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('A user with that username already exists');
      } else {
        throw error;
      }
    }
  }

  /**
   * Update the user details
   */
  async patchUser(req) {
    try {
      //we need to retrieve the user data
      let user =  await User.findById(req.params.user_id)
      // fields that should be removed in case somebody tries to pass them
      const ignoreFields = ['_id', 'username', 'tokens'];

      if ((!req.body.password || !req.body.conf_password) || (req.body.password !== req.body.conf_password)) {
        throw new Error('Passwords do not match', { cause: {
          code: 'notMatch'
        }});
      } else if (req.body.password === '') {
        ignoreFields.push('password');
      } // end if

      ignoreFields.forEach(field => {
        if (req.body[field]) {
          delete req.body[field];
        }
      });
      user = { ...user, ...req.body };
      const data = await user.save();
      return data;
    } catch (error) {
      if (error.cause.code) {
        throw new Error(error.message);
      }
      throw new Error('Could not find the user');
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(req) {
    try {
      await User.deleteOne({
        _id: req.params.user_id
      });
      return 'User deleted successfully';
    } catch (error) {
      throw new Error('Cannot delete the user');
    }
  }

  /**
   * Registration method for new users
   */
  async register(req) {
    try {
      const user = new User();
      if (!req.body.email && validator.isEmail(req.body.email)) {
        throw new Error('The email is not valid');
      } // end if
      user.firstname = validator.trim(req.body.firstname);
      if (!req.body.firstname) {
        throw new Error('Firstname Required');
      } // end if
      user.lastname = validator.trim(req.body.lastname);
      if (!req.body.lastname) {
        throw new Error('Lastname Required');
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
        throw new Error('Password is too short, must be at least 12 characters long');
      } // end if
      if ((!req.body.password || !req.body.conf_password) || (req.body.password !== req.body.conf_password)) {
        throw new Error('Password do not match');
      } // end if
      user.password = req.body.password;

      // save the user and check for errors
      const data = await user.save();
      this.sendActivationEmail(user);
      return data;
    
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('A user with that email already exists');
      } else {
        throw new Error(error.message);
      } // end if
    }
  }
  /**
   * Send the activation emails for newly created users
   */
  sendActivationEmail(user) {
    let token = this.generateAuthToken(user);


    // Configure mailgen by setting a theme and your product info
    // const mailGenerator = new Mailgen({
    //   theme: 'salted',
    //   product: {
    //     // Appears in header & footer of e-mails
    //     name: 'Test',
    //     link: 'https://example.com/'
    //     // Optional logo
    //     // logo: 'https://mailgen.js/img/logo.png'
    //   }
    // });

    // // Prepare email contents
    // const email = {
    //   body: {
    //     name: user.firstname,
    //     intro: 'Hi, in order to activate your account on example.com we need to check if you email is valid.',
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

    // // let message = '<p>Hi, in order to activate your account on example.com we need to confirm your account, to do so please click on the link below:</p>\
    // //  <p><a href="http://'+config.domain+'/index.html#/activation/'+token+'">Activate your account</a></p>\
    // //  <p>Best Regards<br />The Test Team</p>';
    // Mailer.sendMail({
    //   from: `Test Mailer < $ {
    //     config.get('mail.noReply')
    //   } > `,
    //   to: user.email,
    //   subject: 'Welcome to Test',
    //   html: emailBody
    // });
  }
  /**
   * Find the user by its email and send the change password email
   */
  async forgotPassword(req) {
    try {
      const email = req.body.email.trim();
      if (!validator.isEmail(email)) {
        throw new Error('Email is not valid');
      } // end if
      const user = await User.findOne({
        email: email
      });
      user.issueNewSecurityToken();
      // if we found a user, we send him an email
      // let token = this.generateAuthToken(user);

      // // Configure mailgen by setting a theme and your product info
      // let mailGenerator = new Mailgen({
      //   theme: 'salted',
      //   product: {
      //     // Appears in header & footer of e-mails
      //     name: 'Test',
      //     link: 'https://example.com/'
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
      //     outro: [`If you haven 't request it, please ignore this email.`,`Best Regards`, `The Test Team`]
      //   }
      // };

      // // let message = `<p>Hi, you received this email because you requested to reset your password account:</p>\
      // //  <p><a href="http://${config.get('server.domain ')}/reset-pwd/${token}">Click here to reset your password</a></p>\
      // //  <p>If you haven\'t request it, please ignore this email.</p>\
      // //  <p>Best Regards<br />The Test Team</p>`;

      // // Generate an HTML email using mailgen
      // let emailBody = mailGenerator.generate(email);

      //  Mailer.sendMail({
      //    from: `Yavin Mailer<${config.get('mail.noReply ')}>`,
      //    to: req.body.email,
      //    subject: 'Test password reset ',
      //    html: emailBody
      //  });

      //  callback(null, {
      //    success: true,
      //    message: 'Email sent!'
      //  });
    } catch (error) {
      throw new Error('The email passed does not exists');
    }
  }

  /**
   * Reset the password for a specific user
   */
  async resetPassword(req){
    let new_password = req.body.new_password;
    let conf_new_password = req.body.conf_new_password;
    const token = req.body.token;
    try {
      const data = await this.decodeAuthToken(token)
      let { user } = data;
      if((!new_password || !conf_new_password) || (new_password !== conf_new_password)){
        throw new Error('Password do not match')
      }// end if
      user.password = new_password;
      user.tokens = user.markTokenAsUsed(data.securityToken);
      const userData = await user.save();
      return userData;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get the user data
   * @alias getUserById
   */
  async getUser(req) {
    const userId = req.params.id;
    return getUserById(userId);
  }
  /**
   * Get ther user data
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      throw new Error('Cannot find the user');
    }
  }
  /**
   * Get the list of users that are active and admins
   */
  async getAdmins() {
    let query = User.find({
      is_admin: true,
      active: true
    });

    try {
      const users = await query.exec();
      return users;
    } catch (error) {
      throw new Error('Cannot find the admins');
    }
  }

  /**
   * Get the full list of users
   */
  async getUsers(req){
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
    try {
      const count = await  User.countDocuments(queryFilter);

      let query = User.find(queryFilter);
      query.sort(' +email ');
      query.select(' -tokens ');
      if(limit && page){
        query.limit(limit);
        query.skip(offset);
      }// end if
      const list = await query.exec();
      return {
        list,
        count: count,
        pages: Math.ceil(count/limit),
        limit: limit,
        page: page
      }
    } catch (error) {
      throw new Error('cannot find the users');
    }
  }

  async getMe(req) {
    return User
      .findById(req.decoded.id, ' -tokens -last_login -registration_date')
      .exec();
  }
};

module.exports = new Users();