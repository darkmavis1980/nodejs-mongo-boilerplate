'use strict';

const Users = require('../classes/users');
const jwt = require('jsonwebtoken');
const config = require('config');
const secretKey = config.get('security.secret');

const isAdmin = (req, res, next) => {
  if(!req.decoded.is_admin){
    let me = Users.getMe(req, (err, data) => {
      if(err){
        res
          .status(500)
          .json({message: 'User not found'})
          .end();
      } else {
        if(!data){
          res
            .status(500)
            .json({message: 'User not found'})
            .end();
        } else {
          if(!data.is_admin){
            res
              .status(403)
              .json({message: `You don't have the permissions to execute this call`})
              .end();
          } else {
            next();
          }
        }
      }// end if
    });
  } else {
    next();
  }
}

const isAuthenticated = (req, res, next) => {
  let token = req.body.token || req.query.token || req.headers.authorization;
  //decode the token
  if(token){
    jwt.verify(token, secretKey, (err, decoded) => {
      if(err){
        res.status(403).send({
          message: 'Failed to authenticate token'
        });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    return res.status(403).send({
      message: 'Token not provided'
    });
  }
}

module.exports = { isAdmin, isAuthenticated };