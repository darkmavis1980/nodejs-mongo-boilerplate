'use strict';

const Users = require('../classes/users');
const jwt = require('jsonwebtoken');
const config = require('config');
const secretKey = config.get('security.secret');

const isAdmin = async (req, res, next) => {
  if(!req.decoded.is_admin){
    try {
      let data = await Users.getMe(req);
      if(!data.is_admin){
        res
          .status(403)
          .json({message: `You don't have the permissions to execute this call`})
          .end();
      } else {
        next();
      }
    } catch (error) {
      res
        .status(500)
        .json({message: 'User not found', error})
        .end();
    }
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