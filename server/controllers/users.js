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
  PostRegister: async (req, res) => {
    try {
      const msg = await Users.register(req);
      res.status(200).json({message: msg}).end();
    } catch (error) {
      res.status(400).json({error}).end();
    }
  },
  PostActivate: async (req, res) => {
    try {
      const msg = await Users.activate(req);
      res.status(200).json({message: 'User successfully activated'}).end();
    } catch (error) {
      res.status(400).json({error}).end();
    }
  },
  PostForgotPassword: async (req, res) => {
    try {
      await Users.forgotPassword(req);
      res.status(200).json({message: 'Reset password email sent'}).end();
    } catch (error) {
      res.status(400).json({error}).end()
    }
  },
  PostPasswordReset: async (req, res) => {
    try {
      await Users.resetPassword(req);
      res.status(200).json({message: 'Password has been reset'}).end();
    } catch (error) {
      res.status(400).json({error}).end()
    }
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
  PostUsers: async (req, res) => {
    try {
      const user = await  Users.newUser(req);
      res
        .status(200)
        .json(user)
        .end();
    } catch (error) {
      res
        .status(400)
        .json({error})
        .end();
    }
  },
  PatchUser: async (req, res) => {
    try {
      const user = await Users.patchUser(req);
      return res
        .status(200)
        .json(user)
        .end();
    } catch (error) {
      return res
          .status(400)
          .json({
            message: 'Could not save the user details',
            error,
          })
          .end();
    }
  },
  DeleteUser: async (req, res) => {
    try {
      const msg = await Users.deleteUser(req);
      res
        .status(200)
        .json({message: msg})
        .end();
    } catch (error) {
      res
        .status(400)
        .json({error})
        .end();
    }
  },
  GetUser: async (req, res) => {
    try {
      const user = await Users.getUserById(req.params.user_id);
      return res
        .status(200)
        .json(user)
        .end();
    } catch (error) {
      return res
        .status(400)
        .json({message: 'Could not find the user', error})
        .end();
    }
  },
  GetUsers: async (req, res) => {
    try {
      const data = await Users.getUsers(req);
      res
        .status(200)
        .json(data)
        .end();
    } catch (error) {
      return res
        .status(400)
        .json({
          error
        })
        .end();
    }
  },
  GetMe: async (req, res) => {
    try {
      const data = await Users.getMe(req);
      let response = {};
      //converts the mongoose document to plain object
      if(typeof data === 'object'){
        response = data.toObject();
      }
      res.send(response);
    } catch (error) {
      return res
        .status(400)
        .json({
          error
        })
        .end();
    }
  },
  PostUserSettings: async (req, res) => {
    try {
      const user = await User.findById(req.decoded.id);

      user.userSettings = req.body.settings;

      const data = await user.save();
      return res.json(data).end();
    } catch (error) {
      res.status(400);
      return res.json({
        success: false,
        error
      });
    }
  },
  PatchMe: async (req, res) => {
    try {
      let user = await User.findById(req.decoded.id);
      const readOnlyFields = ['active', 'is_admin', 'registration_date'];
      readOnlyFields.forEach(field => {
        if(!req.body[field]){
          delete req.body[field];
        }
      });
      // update the user object
      user = { ...user, ...req.body };
      const data = await user.save();
      return res.json(data).end();
    } catch (error) {
      res.status(404)
      .json({message: 'Cannot find/update this user', error})
      .end();
    }
  },
  PatchMeUpdatePassword: async (req, res) => {
    try {
      const user = await User.findOne({ _id: req.decoded.id })
      .select('username password')
      .exec();
      // we check if the password match
      if(user.comparePassword(req.body.old_password)){
        if(req.body.password === req.body.conf_password && req.body.password.length > 7){
          user.password = req.body.password;
          await user.save();
          return res.json({message: 'The password has been updated'}).end();
        } else {
          throw new Error('The two passwords do not match or one of them is too short');
        }
      }
      return res
        .status(500)
        .json({message: 'The current password is not correct'})
        .end();
    } catch (error) {
      res.status(404)
        .json({message: 'Cannot find this user', error})
        .end();
    }
  }
}

module.exports = UsersCtrl;