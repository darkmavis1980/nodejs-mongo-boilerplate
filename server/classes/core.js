'use strict';

const config = require('config');
const mongoose = require('mongoose');

/**
 * Core Class with basic common methods
 * @class
 */
class Core{

  /**
   * Returns the default settings
   */
  getSettings(){
    let settings = {
      maxUploadSize: config.max_upload_size
    };

    return settings;
  }
  /**
   * Returns the connection string for MongoDB
   */
  getConnectionString(){
    const connectionUrl = `mongodb://${config.get('dbConfig.username')}:${config.get('dbConfig.password')}@${config.get('dbConfig.host')}/${config.get('dbConfig.name')}${config.get('dbConfig.optionalParams')}`;
    return connectionUrl;
  }

  /**
   * Create db connection
   */
  async dbConnect(silent = false){
    const databaseUri = this.getConnectionString();
    try {
      this.db = await mongoose.connect(databaseUri, {});
      if (!silent) {
        console.log('connected');
      }
    } catch (error) {
      console.log('cannot connect with the DB');
      mongoose.disconnect();
      setTimeout(this.dbConnect.bind(this),5000);
    }
    return mongoose;
  }

  /**
  * Validate an ObjectId
  */
  isObjectId(id){
    return id.match(/^[0-9a-fA-F]{24}$/);
  }

  /**
   * Encode a string into base64
   */
  encode64(text){
    let encoded = new Buffer(text);
    return encoded.toString('base64');
  }

  /**
   * Decode a string from base64
   */
  decode64(enctext){
    let decoded = new Buffer(enctext, 'base64');
    return decoded.toString();
  }

  /**
   * Disable server cache to be used as a middleware
   */
  noCache(req, res, next){
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", 0);
    res.set('Last-Modified', (new Date()).toUTCString());
    next();
  }

  /*
   * Flatten Object @gdibble: Inspired by https://gist.github.com/penguinboy/762197
   *   input:  { 'a':{ 'b':{ 'b2':2 }, 'c':{ 'c2':2, 'c3':3 } } }
   *   output: { 'a.b.b2':2, 'a.c.c2':2, 'a.c.c3':3 }
   */
   flattenObject(ob) {
     let toReturn = {};
     let flatObject;
     for (let i in ob) {
       if (!ob.hasOwnProperty(i)) {
         continue;
       }
       //Exclude arrays from the final result
       //Check this http://stackoverflow.com/questions/4775722/check-if-object-is-array
       if(ob[i] && Array === ob[i].constructor){
       	continue;
       }
       if ((typeof ob[i]) === 'object') {
         flatObject = this.flattenObject(ob[i]);
         for (let x in flatObject) {
           if (!flatObject.hasOwnProperty(x)) {
             continue;
           }
           //Exclude arrays from the final result
           if(flatObject[x] && Array === flatObject.constructor){
           	continue;
           }
           toReturn[i + (!!isNaN(x) ? '.' + x : '')] = flatObject[x];
         }
       } else {
         toReturn[i] = ob[i];
       }
     }
     return toReturn;
   }
}

module.exports = new Core();