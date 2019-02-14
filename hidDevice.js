var _ = require('lodash');
import * as hid from 'node-hid';
import {promisify} from 'util';
import common from './commonFunctions';

var debug = require('bows')('HidDevice');

export default function hidDevice(config) {
  config = config || {};
  var connection = null;

  function connect(deviceInfo, probe, cb) {

    if (arguments.length != 3) {
      debug('hid connect called with wrong number of arguments!');
    }

    debug('in HIDDevice.connect, info ', deviceInfo);

    connection = new hid.HID(deviceInfo.vendorId, deviceInfo.productId);

    if (connection) {
      // Set up error listener
      connection.on('error', function(error) {
        debug('Error:', error);
        return cb(error);
      });

      cb();
    } else {
      cb(new Error('Unable to connect to device'));
    }

  }

  function removeListeners() {
    connection.removeAllListeners('error');
  }

  function disconnect(deviceInfo, cb) {
    if (connection === null){
      return cb();
    }else{
      connection.close();
      console.log('disconnected from HIDDevice');
      cb();
    }
  }

  function receive(cb){
    connection.read(function(err, data) {
      if(err) {
        debug('HID Error:', err);
      }
      cb(err, data);
    });
  }

  function receiveTimeout(timeout) {
    return new Promise((resolve, reject) => {
      process.nextTick(() => {
        try {
          resolve(connection.readTimeout(timeout));
        } catch (e) {
          // exceptions inside Promise won't be thrown, so we have to
          // reject errors here (e.g. device unplugged during data read)
          reject(e);
        }
      });
    });
  }

  function send(bytes, callback) {
    var buf = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      var arr = Array.from(buf);
      arr.unshift(0); // The first byte of arr must contain the Report ID.
                      // As we only work with a single report, this is set to 0x00.
      try {
        var bytesWritten = connection.write(arr);
      } catch (err) {
        return callback(err, null);
      }
      callback(null, bytesWritten);
    }
  }

  return {
    connect: connect,
    disconnect: disconnect,
    removeListeners: removeListeners,
    receive: receive,
    receiveTimeout: receiveTimeout,
    sendPromisified: promisify(send),
    send: send
  };

};
