'use strict';

const User = require('../models/users');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const config = require('config');
const secretKey = config.get('security.secret');
const UsersCtrl = require('../controllers/users');
const isAdmin = require('../middlewares/middlewares').isAdmin;
const isAuthenticated = require('../middlewares/middlewares').isAuthenticated;

module.exports = (app, express) => {
  app.use(passport.initialize());
  app.use(passport.session());

  const urlencodedParser = express.urlencoded({ extended: true });
  const jsonParser = express.json();

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });
  // Strategy for Passport
  passport.use(new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    },
    async function(req, username, password, done) {
      try {
        let query = { username: username };
        if(!req.params.admin){
          query.is_admin = true;
        }// end if

        const user = await User
          .findOne(query)
          .select('username +password email firstname active is_admin tokens')
          .exec();

        if (!user) {
          return done(null, false);
        }

        if (!user.comparePassword(password)) {
          return done(null, false);
        }
        return done(null, user);

      } catch (error) {
        done(error);
      }
    }
  ));

  // create the API routes
  let usersApiRouter = express.Router();
  /**
  * @api {post} /authenticate/ Perform an authentication
  * @apiName AuthenticateUser
  * @apiGroup User
  * @apiVersion 0.1.0
  *
  * @apiParam {String} username The username/email address to pass for the login
  * @apiParam {String} password The password to pass for the login
  *
  * @apiSuccess {String} token The JWT token
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFsZXNzaW9AbXVzaWNwaG90b2dyYXBoZXIuZXUiLCJpZCI6IjU5MDBjNmYwYzFlYmE3NmJkM2ZhY2E2OCIsImlhdCI6MTQ5MzI4ODI1MywiZXhwIjoxNDkzNDYxMDUzfQ.cVqHkEMWttGjhQsrZSjMpk2LC9XBCnQuit-FVvWO198",
  *     }
  *
  * @apiError (Error 400) UserNotFound Sorry. The details you entered are incorrect
  *
  * @apiErrorExample UserNotFound
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Sorry. The details you entered are incorrect"
  *    }
  *
  * @apiError (Error 500) UserNotActive The user is not active yet
  *
  * @apiErrorExample UserNotActive
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "This account is not active yet"
  *    }
  *
  */
  usersApiRouter.post('/authenticate/:admin?', jsonParser, UsersCtrl.PostAuthenticate);

  /**
  * @api {post} /register/ Register user
  * @apiName RegisterUser
  * @apiDescription Register a new user in the database
  * @apiGroup User
  * @apiVersion 0.1.0
  *
  * @apiParam {String} email Email for the registration, this will be used also as the username
  * @apiParam {String} password User's password
  * @apiParam {String} conf_password Confirm password, this should match the previous field
  * @apiParam {String} [firstname] User firstname
  * @apiParam {String} [lastname] User lastname
  * @apiParam {String} [company] User's company, not compulsory
  *
  * @apiSuccess {String} message Success message
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "message": "User created!",
  *     }
  *
  * @apiError (Error 400) UserAlreadyRegistered A user with that email already exists
  *
  * @apiErrorExample UserAlreadyRegistered
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "A user with that email already exists"
  *    }
  *
  * @apiError (Error 400) UserEmailNotValid The email passed is not valid
  *
  * @apiErrorExample UserEmailNotValid
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "The email is not correct"
  *    }
  *
  * @apiError (Error 400) UserFirstnameRequired The first name is required
  *
  * @apiErrorExample UserFirstnameRequired
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Firstname Required"
  *    }
  *
  * @apiError (Error 400) UserLastnameRequired The last name is required
  *
  * @apiErrorExample UserLastnameRequired
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Lastname Required"
  *    }
  *
  * @apiError (Error 400) UserPasswordsTooShort The passwords is too short
  *
  * @apiErrorExample UserPasswordsTooShort
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Password is too short, must be at least 12 characters long"
  *    }
  *
  * @apiError (Error 400) UserPasswordsNotMatch The passwords do not match
  *
  * @apiErrorExample UserPasswordsNotMatch
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Passwords do not match"
  *    }
  */
  usersApiRouter.post('/register', jsonParser, UsersCtrl.PostRegister);

  /**
  * @api {post} /activate/ Activate a user
  * @apiName ActivateUser
  * @apiDescription This point will activate the user with the id passed in the payload, if the token is valid, returns an error if the token is not valid or is expired
  * @apiGroup User
  * @apiVersion 0.1.0
  * @apiParam {String} token The activation token to validate
  *
  * @apiSuccess {String} message Success message
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "message": "User successfully activated",
  *     }
  *
  * @apiError (Error 400) UserTokenExpired The user token is missing or expired
  *
  * @apiErrorExample UserTokenExpired
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Token expired or not valid"
  *    }
  */
  usersApiRouter.post('/activate', jsonParser, UsersCtrl.PostActivate);

  /**
  * @api {post} /password/forgot/ Forgot Password request
  * @apiDescription This endpoint expect to receive just the email of the user who wish to reset the password,
  * then the email will be checked if exists in the database, if not, an error will be returned, if it does,
  * then an email will be sent to that address with an activation link
  * @apiName ForgotPasswordUser
  * @apiGroup User
  * @apiVersion 0.1.0
  * @apiParam {String} email The email of the user that wish to reset the password
  *
  * @apiSuccess {String} message Success message
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "message": "Reset password email sent",
  *     }
  *
  * @apiError (Error 400) UserEmailNotExists The email sent is not in the database
  *
  * @apiErrorExample Error-Response:
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "The email passed does not exists"
  *    }
  */
  usersApiRouter.post('/password/forgot', jsonParser, UsersCtrl.PostForgotPassword);

  /**
  * @api {post} /password/reset/ Reset password
  * @apiName ResetPasswordUser
  * @apiDescription This will allow the user to reset his password, given that the passed token is valid and the two passwords match
  * @apiGroup User
  * @apiParam {String} token The verification token sent by the API
  * @apiParam {String} new_password The new password to set
  * @apiParam {String} conf_new_password The confirmation password that has to match with previous field
  *
  * @apiSuccess {String} message Success message
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "message": "Password has been reset",
  *     }
  *
  * @apiError (Error 400) UserPasswordNoMatch The two passwords do not match
  *
  * @apiErrorExample UserPasswordNoMatch
  *    HTTP/1.1 400 Bad Request
  *    {
  *      "message": "Password do not match"
  *    }
  *
  * @apiError (Error 500) TokenExpiredOrInvalid The token passed is not valid
  *
  * @apiErrorExample TokenExpiredOrInvalid
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "The token passed is not valid"
  *    }
  */
  usersApiRouter.post('/password/reset', jsonParser, UsersCtrl.PostPasswordReset);

  /*
   * FROM HERE EVERY CALL MUST BE AUTHENTICATED
  */
  // usersApiRouter middleware
  usersApiRouter.use(jsonParser, isAuthenticated);

  /**
  * @api {get} /logout/ Logout a user
  * @apiName LogoutUser
  * @apiHeader {String} token The access token
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *
  */
  usersApiRouter.get('/logout', UsersCtrl.GetLogout);

  /**
  * @api {get} /verifytoken/ Verify User Token GET
  * @apiName VerifyTokenGet
  * @apiDescription Verify if the given token is valid or not, if it's valid it returns the user Object ID
  * @apiHeader {String} token The access token
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccess {Number} id The user id
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "id": "12345",
  *     }
  *
  * @apiError (Error 500) UserTokenNotValid The token passed is not valid
  *
  * @apiErrorExample Error-Response:
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "You don't have a valid token"
  *    }
  */
  usersApiRouter.get('/verifytoken', UsersCtrl.GetVerifyToken);

  /**
  * @api {post} /verifytoken/ Verify User Token POST
  * @apiName VerifyTokenPost
  * @apiDescription Verify if the given token is valid or not, if it's valid it returns the user Object ID, same as the endpoint above, but just with the POST protocol
  * @apiHeader {String} token The access token
  * @apiParam {String} token The verification token
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccess {Number} id The user id
  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "id": "12345",
  *     }
  *
  * @apiError (Error 500) UserTokenNotValid The token passed is not valid
  *
  * @apiErrorExample Error-Response:
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "You don't have a valid token"
  *    }
  */
  usersApiRouter.post('/verifytoken', UsersCtrl.PostVerifyToken);

  //users routes
  usersApiRouter.route('/users')
    /**
    * @api {post} /users/ Create a new user
    * @apiName UsersPost
    * @apiDescription Endpoint to create a new user, this is more loosely validated than the register endpoint and it should be use only for administrator users
    * @apiGroup Users Management
    * @apiHeader {String} token The access token
    * @apiVersion 0.1.0
    * @apiPermission admin
    * @apiParam {String} email Email address of the user, this will be used also as the username
    * @apiParam {String} password User's password
    * @apiParam {String} [firstname] User firstname
    * @apiParam {String} [lastname] User lastname
    * @apiParam {String} [company] User's company, not compulsory
    * @apiParam {Boolean} [active] True if you want to set the user active, false otherwise
    * @apiParam {Boolean} [id_admin] True if you want to set the user as an admin, false otherwise
    *
    * @apiSuccess {String} _id The user id
    * @apiSuccess {String} email The user's email address
    * @apiSuccess {String} username The user's username
    * @apiSuccess {String} firstname The user's firstname
    * @apiSuccess {String} lastname The user's lastname
    * @apiSuccess {String} company The user's company
    * @apiSuccess {Object[]} tokens An array of objects containing the auth tokens
    * @apiSuccess {Date} registration_date When the user registred
    * @apiSuccess {Boolean} active True if the user is active, false otherwise
    * @apiSuccess {Boolean} id_admin True if the user is an admin, false otherwise
    *
    * @apiSuccessExample Success-Response:
    *     HTTP/1.1 200 OK
    * {
    *     "__v": 0,
    *     "username": "tester@test.com",
    *     "company": "",
    *     "email": "tester@test.com",
    *     "lastname": "John",
    *     "firstname": "Doe",
    *     "_id": "597b61190e6a5d2149646c4e",
    *     "tokens": [],
    *     "registration_date": "2017-07-28T16:06:49.296Z",
    *     "active": false,
    *     "id_admin": false
    * }
    *
    * @apiError (Error 400) UserAlreadyRegistered A user with that email already exists
    *
    * @apiErrorExample UserAlreadyRegistered
    *    HTTP/1.1 400 Bad Request
    *    {
    *      "message": "A user with that email already exists"
    *    }
    *
    * @apiError (Error 403) TokenNotProvided No token provided
    *
    * @apiErrorExample TokenNotProvided
    *    HTTP/1.1 403 Forbidden
    *    {
    *      "message": "Token not provided"
    *    }
    */
    .post(urlencodedParser, isAdmin, UsersCtrl.PostUsers)

    /**
    * @api {get} /users/ Get the list of users
    * @apiName UsersGet
    * @apiDescription Return the full list of users
    * @apiGroup Users Management
    * @apiHeader {String} token The access token
    * @apiVersion 0.1.0
    * @apiPermission admin
    * @apiParam {String} [page] The current page of users to list
    *
    * @apiSuccess {String} _id The user id
    * @apiSuccess {String} email The user's email address
    * @apiSuccess {String} username The user's username
    * @apiSuccess {String} firstname The user's firstname
    * @apiSuccess {String} lastname The user's lastname
    * @apiSuccess {Date} last_login The last date where the user logged in
    * @apiSuccess {Object[]} tokens An array of objects containing the auth tokens
    * @apiSuccess {String} tokens.token An encrypted string representing the auth token
    * @apiSuccess {Date} tokens.expiry The expiration date of the token
    * @apiSuccess {String} tokens._id The token ID
    * @apiSuccess {Boolean} tokens.used A boolean value to show if the token has been used or not
    * @apiSuccess {Date} tokens.issue_date The date of when the token was issued
    * @apiSuccess {Date} registration_date When the user registred
    * @apiSuccess {Boolean} active True if the user is active, false otherwise
    * @apiSuccess {Boolean} id_admin True if the user is an admin, false otherwise
    *
    * @apiSuccessExample Success-Response:
    *     HTTP/1.1 200 OK
    *  [
    *    {
    *        "_id": "596cc28c92628b1f504860fe",
    *        "email": "test@test.com",
    *        "username": "test@test.com",
    *        "lastname": "Test",
    *        "firstname": "Test",
    *        "__v": 0,
    *        "last_login": "2017-07-27T13:58:26.641Z",
    *        "tokens": [
    *            {
    *                "token": "bd549d97abb3cf8d9b66c19eef70eea0bda135ddb245e382bda59a7f3ab066ed",
    *                "expiry": "2017-07-18T13:58:36.449Z",
    *                "_id": "596cc28c92628b1f504860ff",
    *                "used": false,
    *                "issue_date": "2017-07-17T13:58:36.451Z"
    *            }
    *        ],
    *        "registration_date": "2017-07-28T09:07:05.106Z",
    *        "active": true,
    *        "id_admin": true
    *    },
    *    ...
    *  ]
    *
    * @apiError (Error 403) TokenNotProvided No token provided
    *
    * @apiErrorExample TokenNotProvided
    *    HTTP/1.1 403 Forbidden
    *    {
    *      "message": "Token not provided"
    *    }
    *
    */
    .get(isAdmin, UsersCtrl.GetUsers);

  // /users/:user_id routes
  // @NOTE: Only admins can access to these endpoints
  usersApiRouter.route('/users/:user_id')
    /**
    * @api {get} /users/:user_id Get the details of a user
    * @apiName UserGet
    * @apiDescription Return the details of the user
    * @apiGroup Users Management
    * @apiHeader {String} token The access token
    * @apiVersion 0.1.0
    * @apiPermission admin
    * @apiParam {String} user_id The user object id
    *
    * @apiSuccess {String} _id The user id
    * @apiSuccess {String} email The user's email address
    * @apiSuccess {String} username The user's username
    * @apiSuccess {String} firstname The user's firstname
    * @apiSuccess {String} lastname The user's lastname
    * @apiSuccess {Date} last_login The last date where the user logged in
    * @apiSuccess {Object[]} tokens An array of objects containing the auth tokens
    * @apiSuccess {String} tokens.token An encrypted string representing the auth token
    * @apiSuccess {Date} tokens.expiry The expiration date of the token
    * @apiSuccess {String} tokens._id The token ID
    * @apiSuccess {Boolean} tokens.used A boolean value to show if the token has been used or not
    * @apiSuccess {Date} tokens.issue_date The date of when the token was issued
    * @apiSuccess {Date} registration_date When the user registred
    * @apiSuccess {Boolean} active True if the user is active, false otherwise
    * @apiSuccess {Boolean} id_admin True if the user is an admin, false otherwise
    *
    * @apiSuccessExample Success-Response:
    *     HTTP/1.1 200 OK
    *    {
    *        "_id": "596cc28c92628b1f504860fe",
    *        "email": "test@test.com",
    *        "username": "test@test.com",
    *        "lastname": "Test",
    *        "firstname": "Test",
    *        "__v": 0,
    *        "last_login": "2017-07-27T13:58:26.641Z",
    *        "tokens": [
    *            {
    *                "token": "bd549d97abb3cf8d9b66c19eef70eea0bda135ddb245e382bda59a7f3ab066ed",
    *                "expiry": "2017-07-18T13:58:36.449Z",
    *                "_id": "596cc28c92628b1f504860ff",
    *                "used": false,
    *                "issue_date": "2017-07-17T13:58:36.451Z"
    *            }
    *        ],
    *        "registration_date": "2017-07-28T09:07:05.106Z",
    *        "active": true,
    *        "id_admin": true
    *    }
    *
    * @apiError (Error 400) UserNotFound No user found for that id
    *
    * @apiErrorExample UserNotFound
    *    HTTP/1.1 400 Bad Request
    *    {
    *       "message": "Could not find the user",
    *       "error": {
    *           "message": "Cast to ObjectId failed for value \"234\" at path \"_id\" for model \"User\"",
    *           "name": "CastError",
    *           "stringValue": "\"234\"",
    *           "kind": "ObjectId",
    *           "value": "234",
    *           "path": "_id"
    *       }
    *    }
    *
    * @apiError (Error 403) TokenNotProvided No token provided
    *
    * @apiErrorExample TokenNotProvided
    *    HTTP/1.1 403 Forbidden
    *    {
    *      "message": "Token not provided"
    *    }
    *
    */
    .get(isAdmin, UsersCtrl.GetUser)
    /**
    * @api {patch} /users/:user_id Update the details for a user
    * @apiName UserPatch
    * @apiDescription Return the details of the user
    * @apiGroup Users Management
    * @apiHeader {String} token The access token
    * @apiVersion 0.1.0
    * @apiPermission admin
    * @apiParam {String} user_id The user object id
    * @apiParam {String} [email] The user's email address
    * @apiParam {String} [firstname] The user's firstname
    * @apiParam {String} [lastname] The user's lastname
    * @apiParam {String} [company] The user's lastname
    * @apiParam {Boolean} [active] True if the user is active, false otherwise
    * @apiParam {Boolean} [id_admin] True if the user is an admin, false otherwise
    *
    * @apiSuccess {String} _id The user id
    * @apiSuccess {String} email The user's email address
    * @apiSuccess {String} username The user's username
    * @apiSuccess {String} firstname The user's firstname
    * @apiSuccess {String} lastname The user's lastname
    * @apiSuccess {String} company The user's company
    * @apiSuccess {Date} last_login The last date where the user logged in
    * @apiSuccess {Object[]} tokens An array of objects containing the auth tokens
    * @apiSuccess {String} tokens.token An encrypted string representing the auth token
    * @apiSuccess {Date} tokens.expiry The expiration date of the token
    * @apiSuccess {String} tokens._id The token ID
    * @apiSuccess {Boolean} tokens.used A boolean value to show if the token has been used or not
    * @apiSuccess {Date} tokens.issue_date The date of when the token was issued
    * @apiSuccess {Date} registration_date When the user registred
    * @apiSuccess {Boolean} active True if the user is active, false otherwise
    * @apiSuccess {Boolean} id_admin True if the user is an admin, false otherwise
    *
    * @apiSuccessExample Success-Response:
    *     HTTP/1.1 200 OK
    *    {
    *        "_id": "596cc28c92628b1f504860fe",
    *        "email": "test@test.com",
    *        "username": "test@test.com",
    *        "lastname": "Test",
    *        "firstname": "Test",
    *        "company": "Test",
    *        "__v": 0,
    *        "last_login": "2017-07-27T13:58:26.641Z",
    *        "tokens": [
    *            {
    *                "token": "bd549d97abb3cf8d9b66c19eef70eea0bda135ddb245e382bda59a7f3ab066ed",
    *                "expiry": "2017-07-18T13:58:36.449Z",
    *                "_id": "596cc28c92628b1f504860ff",
    *                "used": false,
    *                "issue_date": "2017-07-17T13:58:36.451Z"
    *            }
    *        ],
    *        "registration_date": "2017-07-28T09:07:05.106Z",
    *        "active": true,
    *        "id_admin": true
    *    }
    *
    * @apiError (Error 400) UserNotFound No user found for that id
    *
    * @apiErrorExample UserNotFound
    *    HTTP/1.1 400 Bad Request
    *    {
    *       "message": "Could not find the user",
    *       "error": {
    *           "message": "Cast to ObjectId failed for value \"234\" at path \"_id\" for model \"User\"",
    *           "name": "CastError",
    *           "stringValue": "\"234\"",
    *           "kind": "ObjectId",
    *           "value": "234",
    *           "path": "_id"
    *       }
    *    }
    *
    * @apiError (Error 403) TokenNotProvided No token provided
    *
    * @apiErrorExample TokenNotProvided
    *    HTTP/1.1 403 Forbidden
    *    {
    *      "message": "Token not provided"
    *    }
    *
    */
    .patch(urlencodedParser, isAdmin, UsersCtrl.PatchUser)

    /**
    * @api {delete} /users/:user_id Delete a user
    * @apiName UserDelete
    * @apiDescription Delete the user from the database
    * @apiGroup Users Management
    * @apiHeader {String} token The access token
    * @apiVersion 0.1.0
    * @apiPermission admin
    * @apiParam {String} user_id The user object id
    *
    * @apiSuccess {String} message Response message
    *
    * @apiSuccessExample Success-Response:
    *     HTTP/1.1 200 OK
    *    {
    *      "message": "User deleted successfully"
    *    }
    *
    * @apiError (Error 400) UserNotFound No user found for that id
    *
    * @apiErrorExample UserNotFound
    *    HTTP/1.1 400 Bad Request
    *    {
    *       "message": "Could not find the user",
    *       "error": {
    *           "message": "Cast to ObjectId failed for value \"234\" at path \"_id\" for model \"User\"",
    *           "name": "CastError",
    *           "stringValue": "\"234\"",
    *           "kind": "ObjectId",
    *           "value": "234",
    *           "path": "_id"
    *       }
    *    }
    *
    * @apiError (Error 403) TokenNotProvided No token provided
    *
    * @apiErrorExample TokenNotProvided
    *    HTTP/1.1 403 Forbidden
    *    {
    *      "message": "Token not provided"
    *    }
    *
    */
    .delete(isAdmin, UsersCtrl.DeleteUser);

  //usersApiRouter.post('/user/settings', jsonParser, UsersCtrl.PostUserSettings);

  /**
  * @api {get} /me/ Returns current user info
  * @apiName UserMe
  * @apiDescription Returns the information regarding the current user
  * @apiHeader {String} token The access token
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccess {Number} _id The user id
  * @apiSuccess {String} email The user email address
  * @apiSuccess {String} username The user name
  * @apiSuccess {String} lastname The user last name
  * @apiSuccess {String} firstname The user first name
  * @apiSuccess {String} company The user company
  * @apiSuccess {Boolean} active If the user is active or not
  * @apiSuccess {Boolean} id_admin If the user is admin or not

  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "_id": "5900c6f0c1eba76bd3faca68",
  *       "email": "address@domain.ext",
  *       "username": "address@domain.ext",
  *       "lastname": "John",
  *       "firstname": "Doe",
  *       "company": null,
  *       "active": true,
  *       "id_admin": false
  *     }
  *
  */
  usersApiRouter.get('/me', UsersCtrl.GetMe);
  /**
  * @api {patch} /me/ Update current user info
  * @apiName UpdateUser
  * @apiDescription Update the information regarding the current user
  * @apiHeader {String} token The access token
  * @apiParam {String} firstname The new value for the firstname field
  * @apiParam {String} lastname The new value for the lastname field
  * @apiParam {String} company The new value for the company field
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccess {Number} _id The user id
  * @apiSuccess {String} email The user email address
  * @apiSuccess {String} username The user name
  * @apiSuccess {String} lastname The user last name
  * @apiSuccess {String} firstname The user first name
  * @apiSuccess {String} company The user company
  * @apiSuccess {Boolean} active If the user is active or not
  * @apiSuccess {Boolean} id_admin If the user is admin or not

  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "_id": "5900c6f0c1eba76bd3faca68",
  *       "email": "address@domain.ext",
  *       "username": "address@domain.ext",
  *       "lastname": "John",
  *       "firstname": "Doe",
  *       "company": null,
  *       "active": true,
  *       "id_admin": false
  *     }
  *
  * @apiError (Error 404) CannotFindUser The user cannot be found
  *
  * @apiErrorExample CannotFindUser
  *    HTTP/1.1 404 Not Found
  *    {
  *      "message": "Cannot find this user"
  *    }
  *
  *
  * @apiError (Error 500) CannotUpdateUser The user cannot be updated
  *
  * @apiErrorExample CannotUpdateUser
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "Cannot save this user"
  *    }
  */
  usersApiRouter.patch('/me', jsonParser, UsersCtrl.PatchMe);
  /**
  * @api {patch} /me/updatepwd/ Update current user password
  * @apiName UpdateUserPassword
  * @apiDescription Update the password of the current user
  * @apiHeader {String} token The access token
  * @apiParam {String} old_password The old user password
  * @apiParam {String} password The new password to set
  * @apiParam {String} conf_password The confirmation password that has to match with the field above
  * @apiGroup Current User
  * @apiVersion 0.1.0
  *
  * @apiSuccess {String} message The success response

  *
  * @apiSuccessExample Success-Response:
  *     HTTP/1.1 200 OK
  *     {
  *       "message": "The password has been updated",
  *     }
  *
  * @apiError (Error 404) CannotFindUser The user cannot be found
  *
  * @apiErrorExample CannotFindUser
  *    HTTP/1.1 404 Not Found
  *    {
  *      "message": "Cannot find this user"
  *    }
  *
  *
  * @apiError (Error 500) CannotSavePassword The password cannot be saved
  *
  * @apiErrorExample CannotSavePassword
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "Cannot save the new password"
  *    }
  *
  * @apiError (Error 500) PasswordsDoNotMatch The password do not match
  *
  * @apiErrorExample PasswordsDoNotMatch
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "The two passwords do not match or one of them is too short"
  *    }
  *
  * @apiError (Error 500) CurrentPasswordIncorrect The current password is not correct
  *
  * @apiErrorExample CurrentPasswordIncorrect
  *    HTTP/1.1 500 Internal Server Error
  *    {
  *      "message": "The current password is not correct"
  *    }
  */
  usersApiRouter.patch('/me/updatepwd', jsonParser, UsersCtrl.PatchMeUpdatePassword);

  return usersApiRouter;
}