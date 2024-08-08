'use strict';

const config = require('config');
const nodemailer = require('nodemailer');
const mailService = config.get('mail.service') || 'SES';

const transports = {
  SES: () => {
    const {
      SES
    } = require('@aws-sdk/client-ses');
    return nodemailer.createTransport({
      SES: new SES({
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        },

        region: config.get('aws.region'),

        // The key apiVersion is no longer supported in v3, and can be removed.
        // @deprecated The client uses the "latest" apiVersion.
        apiVersion: '2010-12-01'
      })
    });
  },
  sendgrid: () => {
    let sgTransport = require('nodemailer-sendgrid-transport');
    return nodemailer.createTransport(sgTransport({
      auth: {
        api_key: config.get('mail.sendgrid.key')
      }
    }));
  }
}

let transport =  transports[mailService]();

class Mailer{
  sendMail(transportData, options){
    options = options || {};
    return new Promise((resolve, reject) => {
      if(process.env.NODE_ENV !== 'test' && !config.get('mail.disabled')){
        return transport.sendMail(transportData, function(err, info) {
          if (err) {
            return reject(err);
          } else {
            return resolve(info);
          }// end if
        });
      } else {
        return resolve({});
      }// end if
    });
  }
}

module.exports = new Mailer();