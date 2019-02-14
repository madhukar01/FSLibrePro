var os = require('os');

var _ = require('lodash');
var async = require('async');
var util = require('util');

//var common = require('./commonFunctions');
//var debugMode = require('../../app/utils/debugMode');
var serialDevice = require('./serialDevice');
import hidDevice from './hidDevice';
//var usbDevice = require('./usbDevice');
import driverManager from './driverManager';
// var builder = require('./objectBuilder')();
var hid = require('node-hid');
var usb = require('usb');
//var SerialPort = require('serialport');

import abbottFreeStyleLibre from './abbottFreeStyleLibre';

var device = {
  log: require('bows')('Device')
};

var hostMap = {
  'darwin': 'mac',
  'win32' : 'win',
  'linux': 'linux'
};

device._deviceDrivers = {
  'AbbottFreeStyleLibre': abbottFreeStyleLibre
};

device._deviceComms = {
  'AbbottFreeStyleLibre': hidDevice
};

device._driverManifests =
{
  'AbbottFreeStyleLibre':
  {
    mode: 'HID',
    usb:
    [
      {vendorId: 6753, productId: 13904}, // FreeStyle Libre
      {vendorId: 6753, productId: 13936}  // FreeStyle Libre Pro
    ]
  }
};

device._silentComms = {};
_.forEach(_.keys(device._deviceComms), function(driverId) {

  var comm = device._deviceComms[driverId];

  if (comm.name !== 'UsbDevice') { // usbDevice is an ES6 class not handled here
    device._silentComms[driverId] = comm({silent: true});
    device._deviceComms[driverId] = comm();
  }
});

// this is a cache for device information
// we need it so that what we learn in detect()
// can be used by process().
device._deviceInfoCache = {};

device.init = function(options, cb) {
  var self=this;
  self._defaultTimezone = options.defaultTimezone;
  // self._api = options.api;
  // self._version = options.version;
  // self._groupId = options.targetId;
  self._os = hostMap[os.platform()];
  cb();
};

device.getDriverManifests = function() {
  return _.cloneDeep(this._driverManifests);
};

device.getDriverIds = function() {
  return _.keys(this._driverManifests);
};

device.getDriverManifest = function(driverId) {
  var driverManifest = this._driverManifests[driverId];
  if (!driverManifest) {
    throw new Error('Could not find driver manifest for "' + driverId + '"');
  }
  return driverManifest;
};

device.detectHelper = function(driverId, options, cb) {
  // Detect can run on a loop, so don't pollute the console with logging
  options.silent = true;
  var dm = this._createDriverManager(driverId, options);
  dm.detect(driverId, cb);
};

device._createDriverManager = function(driverId, options) {
  var drivers = {};
  drivers[driverId] = this._deviceDrivers[driverId];
  var configs = {};
  configs[driverId] = this._createDriverConfig(driverId, options);
  // configs.debug = debugMode.isDebug;

  return driverManager(drivers, configs);
};

device._createDriverConfig = function(driverId, options) {
  options = options || {};
  var timezone = options.timezone || this._defaultTimezone;
  var comms = options.silent ? this._silentComms : this._deviceComms;
  // var theVersion = options.version || this._version;
  // var uploadGroup = options.targetId || this._groupId;

  // handle config for block-mode devices, which includes the file name and data
  // if (options.filename != null)
  // {
  //   return {
  //     filename: options.filename,
  //     filedata: options.filedata,
  //     deviceInfo: this._deviceInfoCache[driverId],
  //     timezone: timezone,
  //     // groupId: uploadGroup,
  //     // api: this._api,
  //     // version: options.version,
  //     // builder: builder,
  //     // progress: options.progress,
  //     // dialogDisplay: options.dialogDisplay,
  //     silent: Boolean(options.silent)
  //   };
  // }

  var deviceInfo = this._deviceInfoCache[driverId];

  if(options.serialNumber) {
    _.assign(deviceInfo, {serialNumber: options.serialNumber});
  }

  return {
    deviceInfo: deviceInfo,
    deviceComms: comms[driverId],
    timezone: timezone,
    // groupId: uploadGroup,
    // api: this._api,
    // version: options.version,
    // builder: builder,
    // progress: options.progress,
    // dialogDisplay: options.dialogDisplay,
    // silent: Boolean(options.silent)
  };
};

device.findUsbDevice = function(driverId, usbDevices) {
  var self = this;
  var userSpaceDriver = null;
  var driverManifest = this.getDriverManifest(driverId);
  var combos = _.map(usbDevices, function(i) {
    return _.pick(i, 'product','vendorId','productId');
  });
  self.log('Looking for USB PID/VID(s): ', JSON.stringify(driverManifest.usb));
  self.log('Available USB PID/VIDs:',  JSON.stringify(combos));

  for (var i = 0; i < driverManifest.usb.length; i++) {
    self.log('USB details for ', JSON.stringify(driverManifest.usb[i]), ':',
      util.inspect(usb.findByIds(driverManifest.usb[i].vendorId,
                    driverManifest.usb[i].productId)));
  }

  var matchingUsbDevices = _.filter(usbDevices, function(usbDevice) {
    var found = false;
    for (var i = 0; i < driverManifest.usb.length; i++) {
      if(driverManifest.usb[i].vendorId === usbDevice.vendorId &&
        driverManifest.usb[i].productId === usbDevice.productId) {
        userSpaceDriver = driverManifest.usb[i].driver;
        found = true;
      }
    }
    return found;
  });

  var devices = _.map(matchingUsbDevices, function(result) {
    return {
      driverId: driverId,
      deviceId: result.deviceId,
      vendorId: result.vendorId,
      productId: result.productId,
      userSpaceDriver: userSpaceDriver,
      bitrate: driverManifest.bitrate
    };
  });

  if (devices.length > 1) {
    this.log('WARNING: More than one device found for "' + driverId + '"');
    device.othersConnected = devices.length - 1;
  }

  return _.first(devices);
};

// device.detectUsb = function(driverId, cb) {
//   var usbDevices = _.map(usb.getDeviceList(), function(result) {
//     return {
//       deviceId: result.deviceDescriptor.idDevice,
//       vendorId: result.deviceDescriptor.idVendor,
//       productId: result.deviceDescriptor.idProduct
//     };
//   });
//
//   return cb(null, this.findUsbDevice(driverId, usbDevices));
// };

device.detectHid = function(driverId, cb) {
  return cb(null, this.findUsbDevice(driverId, hid.devices()));
};

// device.detectUsbSerial = function(driverId, cb) {
//   var self = this;
//   var driverManifest = this.getDriverManifest(driverId);
//
//   var getDevice = function(results) {
//     var devices = _.map(results, function(result) {
//       var retval = {
//         driverId: driverId,
//         vendorId: result.vendorId,
//         productId: result.productId,
//         usbDevice: result.device,
//         path: result.comName
//       };
//       if (!!driverManifest.bitrate) {
//         retval.bitrate = driverManifest.bitrate;
//       }
//       if(!!driverManifest.ctsFlowControl) {
//         retval.ctsFlowControl = driverManifest.ctsFlowControl;
//       }
//       if(!!driverManifest.sendTimeout){
//         retval.sendTimeout = driverManifest.sendTimeout;
//       }
//       if(!!driverManifest.receiveTimeout) {
//         retval.receiveTimeout = driverManifest.receiveTimeout;
//       }
//       return retval;
//     });
//
//     var devdata = _.head(devices);
//
//     if (devices.length > 1) {
//       self.log('WARNING: More than one device found for "' + driverId + '"');
//       device.othersConnected = devices.length - 1;
//     }
//     return cb(null, devdata);
//   };
//
//
//   SerialPort.list(function (err, serialDevices) {
//     console.log('Connected device(s):', serialDevices);
//     serialDevices = _.filter(serialDevices, function(serialDevice) {
//       var vendorId = parseInt(serialDevice.vendorId, 16);
//       var productId = parseInt(serialDevice.productId, 16);
//
//       for (var i = 0; i < driverManifest.usb.length; i++) {
//
//         if(driverManifest.usb[i].vendorId === vendorId &&
//            driverManifest.usb[i].productId === productId) {
//
//            if (self._os === 'mac') {
//              if (serialDevice.comName.match('/dev/tty.+')) {
//                return true;
//              }
//            } else {
//              return true;
//            }
//         }
//       }
//       return false;
//     });
//     console.log('Possible device(s):', serialDevices);
//     getDevice(serialDevices);
//   });
// };

device.detect = function(driverId, options, cb) {
  var self = this;
  if (_.isFunction(options)) {
    cb = options;
    options = { version: self._version };
  }
  var driverManifest = this.getDriverManifest(driverId);

  if(driverManifest.mode === 'HID')
  {
      this.detectHid(driverId, function(err, devdata)
      {
        if (err)
        {
          return cb(err);
        }
        if (!devdata)
        {
          return cb();
        }

        self._deviceInfoCache[driverId] = _.cloneDeep(devdata);
        self.detectHelper(driverId, options, function(err, ftdiDevice)
        {
          if (err)
          {
            return cb(err);
          }
          device = _.assign(devdata, ftdiDevice);
          return cb(null, devdata);
        });
      });
  }
};

// device.detectAll = function(cb) {
//   async.map(this.getDriverIds(), this.detect.bind(this), function(err, results) {
//     if (err) {
//       return cb(err);
//     }
//     // Filter out any nulls
//     results = _.filter(results);
//     cb(null, results);
//   });
// };

// device.upload = function(driverId, options, cb) {
//   var dm = this._createDriverManager(driverId, options);
//   dm.process(driverId, function(err, result) {
//     return cb(err, result);
//   });
// };

export default device;
