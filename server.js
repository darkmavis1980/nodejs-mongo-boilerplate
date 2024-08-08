const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const config = require('config');
const serverEnv = process.env.NODE_ENV || 'dev';
let apiBasePath = config.get('server.apiBaseRoot') || '/api';
const FileStreamRotator = require('file-stream-rotator');
let logDirectory = __dirname + '/logs';
const fs = require('fs');
const http = require('http').Server(app);
const Core = require('./server/classes/core');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
// const { rateLimit } = require('express-rate-limit');

/**
 * Connect to MongoDB
 */
const db = Core.dbConnect();
app.db = db;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

/**
 * Sanitize MongoDB request
 */
app.use(mongoSanitize());

/**
 * Add compression
 */
let shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) {
    // don't compress responses with this request header
    return false
  }

  // fallback to standard filter function
  return compression.filter(req, res)
};

/**
 * Session storage, in production it should be saved in a MongoDB Collection
 */
const sess = {
  secret: config.get('security.secret'),
  cookie: {},
  store: MongoStore.create({
    autoRemove: 'interval',
    autoRemoveInterval: 10, // In minutes. Default
    collection: 'sessions',
    mongoUrl: Core.getConnectionString()
  }),
  resave: true,
  saveUninitialized: true
}

if (serverEnv === 'production') {
  // Compression
  app.use(compression({filter: shouldCompress}))
  // Sessions
  app.set('trust proxy', 1); // trust first proxy
  sess.cookie.secure = config.get('server.sslEnabled'); // serve secure cookies
}

app.use(session(sess));

app.use(express.json());

/**
 * Set static files location
 * used for requests that our frontend will make
 */
// app.use('/static', express.static(__dirname + '/static'));

app.use(`${apiBasePath}/docs`, express.static(__dirname + '/apidoc'));

/**
 * Allow CORS
 */
app.use(cors());

if(serverEnv === 'production'){
  // ensure log directory exists
  fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

  // create a rotating write stream
  var accessLogStream = FileStreamRotator.getStream({
    date_format: 'YYYYMMDD',
    filename: logDirectory + '/access-%DATE%.log',
    frequency: 'daily',
    verbose: false
  });

  // log all the request on the console
  app.use(morgan('combined', {stream: accessLogStream}));
}// end if

if(serverEnv !== 'production'){
  app.use(morgan('dev'));
}// end if

app.get(apiBasePath+'/version', Core.noCache, function(req, res){
  var version = require('./package.json').version;
  var data = {
    version
  }
  res.json(data);
});

/**
 * API routes
 */
const usersApiRouter = require('./server/routes/users')(app, express);
/**
 * Assign the API routes to the main app
 */
app.use(apiBasePath, usersApiRouter);

/**
 * To add a rate limit
 */
// const limit = rateLimit({
//   max: 100,// max requests
//   windowMs: 60 * 60 * 1000, // 1 Hour
//   message: 'Too many requests' // message to send
// });
// app.use('/routeName', limit);



// app.get('/*', Core.noCache, function ( req, res ) {
//   res
//     .status( 200 )
//     .set({ 'content-type': 'text/html; charset=utf-8' })
//     .sendFile( __dirname + '/public/index.html' )
// });

/**
 * Start the server
 */
http.listen(config.get('server.port'), config.get('server.host'), function(){
  console.log(`Server started at the address ${config.get('server.host')}:${config.get('server.port')}`);
})

module.exports = app;