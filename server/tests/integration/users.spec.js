process.env.NODE_ENV = 'test';

let mongoose = require("mongoose");
let User = require('../../models/users');
let UserClass = require('../../classes/users');
let UserMock = require('../init').UserMock;

let profile = new UserMock();

//Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../../../server');
let should = chai.should();
let mockNewUser;
let mockNewProfile;

let createNewProfile = next => {
  mockNewUser = {
    firstname : "John",
    lastname: "Doe",
    email: "tester2@example.com",
    username: "tester2@example.com",
    password: "password"
  };
  mockNewProfile = new User(mockNewUser);
  mockNewProfile.save(err => {
    if(err){
      console.log(err);
    }
    next();
  });
}

chai.use(chaiHttp);

// Not authenticated calls
describe('User / Unauthenticated', () => {
  let registration;
  let login;
  // execute once the authentication
  beforeEach((done) => {
    registration = {
      email: 'test@test.com',
      firstname: 'John',
      lastname: 'Doe',
      password: 'test12345678',
      conf_password: 'test12345678',
      company: 'test company'
    };

    login = {
      username: registration.email,
      password: registration.password
    };

    //Before each test we empty the database
    User.remove({}, (err) => {
      done();
    });
  });

  /*
  * Test the /POST route for /register
  */
  describe('/POST register', () => {
    it('should return a 200 OK status if everything is successfull', (done) => {
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
            res.should.have.status(200);
            res.body.should.be.a('object');
            res.body.should.have.property('message').eql('User created!');
          done();
        });
    });

    it('should return a 500 Internal Server Error status if the email is not passed', (done) => {
      delete registration.email;
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
          res.should.have.status(500);
          done();
        });
    });

    it('should return a 400 Internal Server Error status if the passwords do not match', (done) => {
      registration.password = '12345678test';
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });

    it('should return a 500 Internal Server Error status if the password is not sent', (done) => {
      delete registration.password;
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
          res.should.have.status(500);
          done();
        });
    });

    it('should return a 500 Internal Server Error status if the firstname is not sent', (done) => {
      delete registration.firstname;
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
          res.should.have.status(500);
          done();
        });
    });

    it('should return a 500 Internal Server Error status if the lastname is not sent', (done) => {
      delete registration.lastname;
      chai.request(server)
        .post('/api/register')
        .send(registration)
        .end((err, res) => {
          res.should.have.status(500);
          done();
        });
    });

    it('should return a 400 Internal Server Error status if the email is already in use', (done) => {
      registration.username = registration.email;
      registration.active = true;
      let firstReg = new User(registration);
      firstReg.save((err, newUser) => {
        delete registration.username;
        chai.request(server)
          .post('/api/register')
          .send(registration)
          .end((err, res) => {
            res.should.have.status(400);
            res.body.should.be.a('object');
            res.body.should.have.property('message').eql('A user with that email already exists');
            done();
          });
      });

    });
  });

  /*
  * Test the /POST route for /authenticate
  */
  describe('/POST authenticate', () => {
    let newUser;

    beforeEach((done) => {
      User.remove({}, () => {
        registration.username = registration.email;
        registration.active = true;
        newUser = new User(registration);
        newUser.save((err, data) => {
          done();
        });
      });
    });

    it('should return a 200 OK status with a token in the body if everything is correct', (done) => {
      chai.request(server)
        .post('/api/authenticate')
        .send(login)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.property('token');
          done();
        });
    });

    it('should return a 400 Bad Request if the user does not exists', (done) => {
      chai.request(server)
        .post('/api/authenticate')
        .send({username: 'test2@test.com', password: registration.email})
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('message');
          done();
        });
    });

    it('should return a 500 Internal Server Error if the user is not active yet', (done) => {
      User.remove({}, () => {
        registration.username = registration.email;
        registration.active = false;
        newUser = new User(registration);
        newUser.save((err, data) => {
          chai.request(server)
            .post('/api/authenticate')
            .send(login)
            .end((err, res) => {
              res.should.have.status(500);
              res.body.should.have.property('message');
              done();
            });
        });
      });
    });
  });

  /*
  * Test the /POST route for /activate
  */
  describe('/POST activate', () => {

    let activationToken;

    beforeEach((done) => {
      User.remove({}, () => {
        registration.username = registration.email;
        registration.active = false;
        newUser = new User(registration);
        newUser.save((err, data) => {
          activationToken = UserClass.generateAuthToken(data);
          done();
        });
      });
    });

    it('should return a status 200 OK if the token is valid', (done) => {
      chai.request(server)
        .post('/api/activate')
        .send({token: activationToken})
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return a status 400 Bad Request if the token is not valid', (done) => {
      chai.request(server)
        .post('/api/activate')
        .send({token: 'abc'})
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });

    it('should return a status 400 Bad Request if the token is not passed', (done) => {
      chai.request(server)
        .post('/api/activate')
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });
  });

  /*
  * Test the /POST route for /forgot/password
  */
  describe('/POST password/forgot', () => {

    beforeEach((done) => {
      User.remove({}, () => {
        registration.username = registration.email;
        registration.active = false;
        newUser = new User(registration);
        newUser.save((err, data) => {
          done();
        });
      });
    });

    it('should return a status 200 OK if the email exists in the database', (done) => {
      chai.request(server)
        .post('/api/password/forgot')
        .send({email: registration.email})
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return a status 400 Bad Request if the email is not in the database', (done) => {
      chai.request(server)
      .post('/api/password/forgot')
      .send({email: 'another@email.com'})
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });
  });

  /*
  * Test the /POST route for /password/reset
  */
  describe('/POST password/reset', () => {
    let token;

    beforeEach((done) => {
      User.remove({}, () => {
        registration.username = registration.email;
        registration.active = false;
        newUser = new User(registration);
        newUser.save((err, data) => {
          token = UserClass.generateAuthToken(data);
          done();
        });
      });
    });

    it('should return a status 200 OK if everything is valid', (done) => {
      chai.request(server)
        .post('/api/password/reset')
        .send({token, new_password: 'test23456789', conf_new_password: 'test23456789'})
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return a status 400 Bad Request if the passwords do not match', (done) => {
      chai.request(server)
        .post('/api/password/reset')
        .send({token, new_password: 'test23456789', conf_new_password: 'test23456789test'})
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });
  });

});

// Authenticated calls
describe('User / Authenticated', () => {
  // execute once the authentication
  before((done) => {
    profile.auth((err, data) => {
      done()
    });
  });

  // once everything is done we destroy the user
  after((done) => {
    profile.destroy((err, data) => {
      done();
    });
  });

  /*
  * Test the /GET route for /logout
  */
  describe('/GET logout', () => {
    it('should return a status 200 OK if the logout is successful', (done) => {
      chai.request(server)
        .get('/api/logout')
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });
  });
});

describe('Users', () => {
  // execute once the authentication
  before((done) => {
    profile.auth((err, data) => {
      done()
    });
  });

  // once everything is done we destroy the user
  after((done) => {
    profile.destroy((err, data) => {
      done();
    });
  });

  /*
  * Test the /GET route for /users
  */
  describe('/GET users', () => {
    it('should return a status 200 OK', (done) => {
      chai.request(server)
        .get('/api/users')
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return an object with the list array an pagination info', done => {
      chai.request(server)
        .get('/api/users')
        .set('authorization', profile.token)
        .end((err, res) => {
          res.body.should.have.property('list');
          res.body.list.should.be.a('array');
          res.body.should.have.property('count');
          res.body.should.have.property('pages');
          res.body.should.have.property('limit');
          done();
        });
    });

    it('should have the list of current users', done => {
      chai.request(server)
        .get('/api/users')
        .set('authorization', profile.token)
        .end((err, res) => {
          let item = res.body.list[0];
          item.should.be.a('object');
          item.email.should.be.eql(profile.mockProfile.email);
          item.firstname.should.be.eql(profile.mockProfile.firstname);
          done();
        });
    });

    it('should not expose the password for each of the users', done => {
      chai.request(server)
        .get('/api/users')
        .set('authorization', profile.token)
        .end((err, res) => {
          let item = res.body.list[0];
          should.not.exist(item.password);
          done();
        });
    });

    it('should return an empty list array if no users are found', done => {
      User.remove({}, err => {
        chai.request(server)
          .get('/api/users')
          .set('authorization', profile.token)
          .end((err, res) => {
            res.body.list.should.be.empty;
            res.body.count.should.be.eql(0);
            done();
          });
      });
    });

    it('should return a 403 error if no auth token is passed', done => {
      chai.request(server)
        .get('/api/users')
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });

  /*
  * Test the /POST route for /users
  */
  describe('/POST users', () => {
    let mockNewUser

    beforeEach( done => {
      mockNewUser = {
        firstname : "Alessio",
        lastname: "Michelini",
        email: "tester@example.com",
        password: "test"
      };
      done();
    });

    it('should return a 200 OK status if the registration is successfull', done => {
      chai.request(server)
        .post('/api/users')
        .send(mockNewUser)
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return the data of the new user if successfull', done => {
      User.remove({email: mockNewUser.email}, err => {
        chai.request(server)
          .post('/api/users')
          .send(mockNewUser)
          .set('authorization', profile.token)
          .end((err, res) => {
            let newUser = res.body;
            newUser.firstname.should.be.eql(mockNewUser.firstname);
            newUser.lastname.should.be.eql(mockNewUser.lastname);
            newUser.email.should.be.eql(mockNewUser.email);
            done();
          });
      });
    });

    it('should return a 403 error if no auth token is passed', done => {
      chai.request(server)
        .post('/api/users')
        .send(mockNewUser)
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });

    it('should return a 400 Bad Request error if a required field is missing', done => {
      delete mockNewUser.email;
      chai.request(server)
        .post('/api/users')
        .send(mockNewUser)
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });
  });

  /*
  * Test the /GET route for /users/:user_id
  */
  describe('/GET users/:user_id', () => {

    before( done => {
      createNewProfile( () => {
        done();
      });
    });

    after( done => {
      User.remove({_id: mockNewProfile._id}, (err) => {
        done();
      });
    });

    it('should return a 200 OK status with the user details in the body', done => {
      chai.request(server)
        .get(`/api/users/${mockNewProfile._id}`)
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('email');
          res.body.should.have.property('registration_date');
          res.body.email.should.be.eql(mockNewProfile.email);
          done();
        });
    });

    it('should return a 400 bad request error if the id passed does not match any user', done => {
      chai.request(server)
        .get('/api/users/123456')
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });


    it('should return a 403 error if no auth token is passed', done => {
      chai.request(server)
        .get(`/api/users/${mockNewProfile._id}`)
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });

  /*
  * Test the /PATCH route for /users/:user_id
  */
  describe('/PATCH users/:user_id', () => {
    before( done => {
      createNewProfile( () => {
        done();
      });
    });

    after( done => {
      User.remove({_id: mockNewProfile._id}, (err) => {
        done();
      });
    });

    it('should return a 400 bad request error if the id passed does not match any user', done => {
      chai.request(server)
        .patch('/api/users/123456')
        .set('authorization', profile.token)
        .send({firstname: 'Jane'})
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });

    it('should update the user details and return a 200 OK status', done => {
      chai.request(server)
        .patch(`/api/users/${mockNewProfile._id}`)
        .set('authorization', profile.token)
        .send({firstname: 'Jane'})
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.property('firstname');
          res.body.firstname.should.be.eql('Jane');
          done();
        });
    });

    it('should return a 403 error if no auth token is passed', done => {
      chai.request(server)
        .patch(`/api/users/${mockNewProfile._id}`)
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });

  /*
  * Test the /DELETE route for /users/:user_id
  */
  describe('/DELETE users/:user_id', () => {

    before( done => {
      createNewProfile( () => {
        done();
      });
    });

    after( done => {
      User.remove({_id: mockNewProfile._id}, (err) => {
        done();
      });
    });

    it('should return a status 200 OK if the user has been successfully deleted', done => {
      chai.request(server)
        .delete(`/api/users/${mockNewProfile._id}`)
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });

    it('should return a 400 bad request error if the id passed does not match any user', done => {
      chai.request(server)
        .delete('/api/users/123456')
        .set('authorization', profile.token)
        .end((err, res) => {
          res.should.have.status(400);
          done();
        });
    });

    it('should return a 403 error if no auth token is passed', done => {
      chai.request(server)
        .delete(`/api/users/${mockNewProfile._id}`)
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });
});