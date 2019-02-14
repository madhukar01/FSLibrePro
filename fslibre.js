import program from 'commander';
import fs from 'fs';
import async from 'async';
import hidDevice from './hidDevice';
import device from './device';
import pkg from './package.json';
import builder from './objectBuilder';
import abbottFreeStyleLibre from './abbottFreeStyleLibre';

import stringify from './stringify';

// eslint-disable-next-line no-underscore-dangle
global.__DEBUG__ = false;

const intro = 'FSLibre CLI:';
let libreDriver;

program
  .version('0.0.1', null)
  // .option('-u, --username [user]', 'username')
  // .option('-p, --password [pw]', 'password')
  // .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  // .option('-f, --file [path]', 'load deviceInfo and aapPackets from JSON file instead of device')
  .option('-o, --output [path]', 'save processed data to JSON file instead of uploading')
  .parse(process.argv);

const options =
{
  // api,
  timezone: process.env.DEFAULT_TIMEZONE, //program.timezone,
  // version: `${pkg.name} ${pkg.version}`,
  builder: builder(),
};


// if ((program.username && program.password) || program.output) {
  if (program.output)
  {
    device.init(options, initCallback);
  }
  else
  {
    program.help();
  }

function readDataFromFile() {
  console.log(intro, 'Reading JSON data from:', program.file);
  return JSON.parse(fs.readFileSync(program.file, 'utf8'), (k, v) =>
  {
    if (v !== null && typeof v === 'object' && 'type' in v &&
      v.type === 'Buffer' && 'data' in v && Array.isArray(v.data))
      {
        // re-create Buffer objects for data fields of aapPackets
        return Buffer.from(v.data);
      }
    return v;
  });
}

function initCallback() {
  // if (program.file)
  // {
  //   const data = readDataFromFile();
  //
  //   console.log(intro, 'Processing AAP packets, length:', data.aapPackets.length);
  //   libreDriver = abbottFreeStyleLibre(options);
  //   libreDriver.processData(progress => progress, data, processCallback);
  // }
  // else
  // {
  device.detect('AbbottFreeStyleLibre', options, detectCallback);
  // }
}

// function processCallback(error, data) {
//   if (error)
//   {
//     console.log(intro, 'processCallback: Failed:', error);
//     process.exit();
//   }
//
//   console.log(intro, 'Num post records:', data.post_records.length);
//
//   if (program.output) {
//     writeDataToFile(data, done);
//   } else {
//     libreDriver.uploadData(progress => progress, data, uploadCallback);
//   }
// }

function detectCallback(error, deviceInfo) {
  if (deviceInfo !== undefined) {
    console.log(intro, 'detectCallback:', 'deviceInfo: ', deviceInfo);
    options.deviceInfo = deviceInfo;
    if (program.output) {
      copyDataFromDeviceToFile(deviceInfo);
    }
    // else
    // {
    //   device.upload('AbbottFreeStyleLibre', options, uploadCallback);
    // }
  }
  else
  {
    console.error(intro, 'detectCallback:', 'Could not find FreeStyle Libre device. Is it connected via USB?');
    console.error(intro, 'detectCallback:', `Error value: ${error}`);
  }
}

function copyDataFromDeviceToFile(deviceInfo) {
  options.deviceComms = hidDevice();
  libreDriver = abbottFreeStyleLibre(options);
  async.waterfall([
    libreDriver.setup.bind(libreDriver, deviceInfo, () => {}),
    libreDriver.connect.bind(libreDriver, () => {}),
    libreDriver.getConfigInfo.bind(libreDriver, () => {}),
    libreDriver.fetchData.bind(libreDriver, () => {}),
    libreDriver.processData.bind(libreDriver, () => {}),
    // no call to the upload function here, since we only want to download the data from the device
    libreDriver.disconnect.bind(libreDriver, () => {}),
  ], (err, resultOptional) => {
    const result = resultOptional || {};
    libreDriver.cleanup(() => {}, result, () => {
      writeDataToFile(result, done);
    });
  });
}

// function uploadCallback(error) {
//   if (error) {
//     console.log(intro, 'uploadCallback:', 'error: ', error);
//     process.exit();
//   }
//   done();
// }

function writeDataToFile(data, callback) {
  console.log(intro, 'uploadCallback:', 'writing data to file:', program.output);
  fs.writeFile(program.output, stringify(data, {
    indent: 2,
    maxLevelPretty: 3
  }), 'utf8', callback);
}

function done() {
  console.log(intro, 'Done!');
  process.exit();
}
