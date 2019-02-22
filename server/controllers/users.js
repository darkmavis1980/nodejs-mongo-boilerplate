'use strict';

const User = require('../models/users');
const jwt = require('jsonwebtoken');
const config = require('config');
const secretKey = config.get('security.secret');
const passport = require('passport');
const Users = require('../classes/users');

let UsersCtrl = {
  PostAuthenticate: (req, res, next) => {
    let that = this;
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        res.status(400).json({
          message: 'Sorry. The details you entered are incorrect'
        }).end();
        return false;
      }

      if(!user.active){
        Users.sendActivationEmail(user);
        res.status(500).json({
          message: 'The email address used must first be verified before you can login, a verification email has been resent'
        }).end();
        return false;
      }

      req.login(user, (err) => {
        if (err) {
          res.status(400).json({
            message: 'Sorry. The details you entered are incorrect'
          }).end();
          return next(err);
        }
        let signature = {
            name: user.name,
            username: user.username,
            id: user._id
          };
        if(user.is_admin){
          signature.is_admin = user.is_admin;
        }// end if

        Users.logAuthentication(user);
        let token = jwt.sign(signature, secretKey,{
            expiresIn: '1d' //1 day
          }
        );
        res.status(200).json({
          token: token
        });
        return user;
      });
    })(req, res, next);
  },
  PostRegister: (req, res) => {
    Users.register(req, (err, msg) => {
      if(err){
        res.status(400).json({message: err}).end();
      } else {
        res.status(200).json({message: msg}).end();
      }
    });
  },
  PostActivate: (req, res) => {
    Users.activate(req, (err, msg) => {
      if(err){
        res.status(400).json({message: err}).end();
      } else {
        res.status(200).json({message: 'User successfully activated'}).end();
      }
    });
  },
  PostForgotPassword: (req, res) => {
    Users.forgotPassword(req, (err, result) => {
      if(err){
        res.status(400).json({message: err}).end()
      } else {
        res.status(200).json({message: 'Reset password email sent'}).end();
      }
    });
  },
  PostPasswordReset: (req, res) => {
    Users.resetPassword(req, (err, result) => {
      if(err){
        res.status(400).json({message: err}).end()
      } else {
        res.status(200).json({message: 'Password has been reset'}).end();
      }
    });
  },
  GetLogout: (req, res) => {
    req.logout();
    res.status(200).end();
  },
  GetVerifyToken: (req, res) => {
    let token = req.body.token || req.query.token || req.headers.authorization;
    if(token){
      jwt.verify(token, secretKey, (err, decoded) => {
        if(err){
          return res.status(500).json({message: err.name}).end();
        } else {
          res.status(200).json({id: decoded.id}).end();
        }
      });
    } else {
      return res.status(404).json({message: 'You don\'t have a valid token'}).end();
    }
  },
  PostVerifyToken: (req, res) => {
    let token = req.body.token || req.query.token || req.headers.authorization;
    if(token){
      jwt.verify(token, secretKey, (err, decoded) => {
        if(err){
          return res.status(500).json({message: err.name}).end();
        } else {
          res.status(200).json({id: decoded.id}).end();
        }
      });
    } else {
      return res.status(404).json({message: 'You don\'t have a valid token'}).end();
    }
  },
  PostUsers: (req, res) => {
    Users.newUser(req, (err, user) => {
      if(err){
        res
          .status(400)
          .json({message: err})
          .end();
      } else {
        res
          .status(200)
          .json(user)
          .end();
      }
    });
  },
  PatchUser: (req, res) => {
    Users.patchUser(req, (err, user) => {
      if(err){
        return res
          .status(400)
          .json({
            message: 'Could not save the user details',
            error: err
          })
          .end();
      } else {
        return res
          .status(200)
          .json(user)
          .end();
      }
    });
  },
  DeleteUser: (req, res) => {
    Users.deleteUser(req, (err, msg) => {
      if(err){
        res
          .status(400)
          .json({message: err})
          .end();
      } else {
        res
          .status(200)
          .json({message: msg})
          .end();
      }
    });
  },
  GetUser: (req, res) => {
    Users.getUserById(req.params.user_id, (err, user) => {
      if(err){
        return res
          .status(400)
         .json({message: 'Could not find the user', error: err})
         .end();
      }
      // if everything is okay and the user is found, return the user data
      return res
        .status(200)
        .json(user)
        .end();
    });
  },
  GetUsers: (req, res) => {
    Users.getUsers(req, (err, data) => {
      if(err){
        return res
          .status(400)
          .json({
            error: err
          })
          .end();
      } else {
        res
          .status(200)
          .json(data)
          .end();
      }
    });
  },
  GetMe: (req, res) => {
    Users.getMe(req, (err, data) => {
      if(err){
        return res
          .status(400)
          .json({
            error: err
          })
          .end();
      } else {
        let response = {};
        //converts the mongoose document to plain object
        if(typeof data === 'object'){
          response = data.toObject();
        }
        // attach the system settings
        //response.settings = Core.getSettings();
        res.send(response);
      }
    });
  },
  PostUserSettings: (req, res) => {
    User.findById(req.decoded.id, (err, user) => {
      if(err){
        res.status(400);
        return res.json({
          success: false,
          error: err
        });
      }

      user.userSettings = req.body.settings;
      user.save((err, data) => {
        if(err){
          res.status(400);
          res.json({
            success: false,
            error: err
          });
          res.end();
        }
        res.json(data);
      });
    });
  },
  PatchMe: (req, res) => {
    User.findById(req.decoded.id, (err, user) => {
      if(err){
        res.status(404)
        .json({message: 'Cannot find this user', error: err})
        .end();
      }// end if
      //remove some security values
      const readOnlyFields = ['active', 'is_admin', 'registration_date'];
      readOnlyFields.forEach(field => {
        if(!req.body[field]){
          delete req.body[field];
        }
      });
      // update the user object
      user = Object.assign(user, req.body);

      user.save((err) => {
        if(err){
          res.status(500)
          .json({message: 'Cannot save this user', error: err})
          .end();
        }// end if
        res.json(user).end();
      });
    });
  },
  PatchMeUpdatePassword: (req, res) => {
    User.findOne({ _id: req.decoded.id })
    .select('username password')
    .exec((err, user) => {
      if(err){
        res.status(404)
        .json({message: 'Cannot find this user', error: err})
        .end();
      }// end if

      // we check if the password match
      if(user.comparePassword(req.body.old_password)){
        if(req.body.password === req.body.conf_password && req.body.password.length > 7){
          user.password = req.body.password;
          user.save((err) => {
            if(err){
              res.status(500)
              .json({message: 'Cannot save the new password', error: err})
              .end();
            } else {
              res.json({message: 'The password has been updated'});
            }
          });
        } else {
          res.status(500)
          .json({message: 'The two passwords do not match or one of them is too short'})
          .end();
        }
      } else {
        res.status(500)
        .json({message: 'The current password is not correct'})
        .end();
      }// end if
    });
  }
}

module.exports = UsersCtrl;