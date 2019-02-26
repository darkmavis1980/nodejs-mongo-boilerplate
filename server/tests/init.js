process.env.NODE_ENV = 'test';

const User = require('../models/users');
const chai = require('chai');
const moment = require('moment');
const _ = require('lodash');

let server = require('../../server');

class UserMock {
  constructor(userData) {
    this.mockUserData = {
      username: 'test@user.ext',
      firstname: 'John',
      lastname: 'Doe',
      email: 'test@user.ext',
      company: 'Company',
      password: 'password1234',
      active: true,
      is_admin: true,
      tokens: [{
        token: '093c1ce9fe6cff3836715315b02fd630a6ed079518e11dabfcb0dd7bfb9296e4',
        used: true,
        issue_date: moment(),
        expiry: moment().add(1, 'days')
      }]
    }

    if (!_.isUndefined(userData)) {
      this.mockUserData = _.assignIn(this.mockUserData, userData);
    }
  }

  create(done) {
    this.mockProfile = new User(this.mockUserData);
    this.mockProfile.save((err, data) => {
      if (err) {
        done(err, null);
      } else {
        done(null, data);
      }
    });
  }

  auth(done) {
    let that = this;
    this.create((err, data) => {
      that.login(done);
    });
  }

  login(done) {
    let that = this;
    chai.request(server).post('/api/authenticate').send({
      username: that.mockUserData.username,
      password: that.mockUserData.password
    }).end(function(err, res) {
      // res.redirects.length.should.equal(0);
      // res.status.should.equal(200);
      that.token = res.body.token;
      //res.type.should.equal('application/json');
      done();
    });
  }

  destroy(done) {
    User.remove({}, (err) => {
      done();
    });
  }
}

module.exports = {
  UserMock
};