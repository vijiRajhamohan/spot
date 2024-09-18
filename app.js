const express = require('express'),
  app = express(),
  bodyParser = require('body-parser'),
  fileUpload = require('express-fileupload');
const server = require('http').createServer(app);
io = require('socket.io')(server, {
  path: '/stt/socket.io'
});

app.set('socketio', io);

app.use('/', express.static('public'))


var sockets = {};
var socketsMetaData = {};
const path = require('path');
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'dev';
//console.log(process.env.NODE_ENV)
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, `config/env/${process.env.NODE_ENV}.env`) });
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname,
  process.env.GOOGLE_APPLICATION_CREDENTIALS
);
const appointmentService = require('./services/Appointments');
const commonUtil = require('./utilities/common');
// Google Cloud
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient(); // Creates a client

// =========================== GOOGLE CLOUD SETTINGS ================================ //

// The encoding of the audio file, e.g. 'LINEAR16'
// The sample rate of the audio file in hertz, e.g. 16000
// The BCP-47 language code to use, e.g. 'en-US'
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: 'en-IN',
    alternativeLanguageCodes: ['en-US', 'en-UK'],
    profanityFilter: false,
    enableWordTimeOffsets: true

    //          enableSpeakerDiarization: true,
    //   diarizationSpeakerCount: 2,
    //   model: `phone_call`,
    // speechContexts: [{
    //     phrases: ["hoful","shwazil"]
    //    }] // add your own speech context for better recognition
  },
  interimResults: true // If you want interim results, set this to true
};
const config = require('./config/Config');
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json({limit: '10mb', extended: true}));

app.use(
  fileUpload({
    useTempFiles : true,
    tempFileDir : '/tmp/',
    createParentPath: true,
    limits: { fileSize: config.upload.maxFileSize * 1024 * 1024 },
    preserveExtension: true,
    responseOnLimit: 'File size limit has been reached'
  })
);

// =========================== SOCKET.IO ================================ //
io.on('connection', function (client) {
  let previousId;
  console.log(`Socket ${client.id} connected.`);
  const safeJoin = currentId => {
    console.log(`safejoin ${client.id} method.`);
    client.leave(previousId);
    client.join(currentId);
    previousId = currentId;
  };

  var clientId = client.id;
  //console.log(`Socket ${client.id} connected.`);
  let recognizeStream = null;
  client.on('join', function (data) {
    console.log("Join event from client socket Connected to Server");
    client.emit('messages', 'Socket Connected to Server');
  });

  client.on('onConferenceTerminated', function (data) {
    console.log("onConferenceTerminated",data);
   
    client.emit('onConfDocTerminated', data);
  });
  // -- TEST --
  client.on('doctorReady', async (data) => {
    console.log("doctorReady event from socket");
    console.log("Printing the client request for doctorReady");

    sockets[data.orgId] = sockets[data.orgId] || {};
    sockets[data.orgId]["Doctor" + data.orgUserMappingId] = client;

    if (!socketsMetaData.hasOwnProperty(data.orgId)) {
        socketsMetaData[data.orgId] = {};
    }
    socketsMetaData[data.orgId]["Doctor" + data.orgUserMappingId] = {};
    socketsMetaData[data.orgId]["Doctor" + data.orgUserMappingId].token = data.token;
  });

  client.on('joinFromTodaysConsultation', async function (date, token) {
    console.log("joinFromTodaysConsultation event from socket");
    let localRequest = {
      // headers: { token: client.request._query.token },
      headers: { token: token },
      url: 'fromSocket',
      body: { ...client.request._query }
    };
    let res = {};
    await commonUtil.authenticationMiddleware(localRequest, res, function () {
      //console.log('letss see');
    });
    var input = localRequest.body;
    var dateValue = commonUtil.getDateFromString(date);
    // safeJoin(input.orgId + dateValue);
    if (!sockets.hasOwnProperty(input.orgId)) {
      sockets[input.orgId] = {};
    }
    sockets[input.orgId][input.type + input.originalOrgUserMappingId] = client;

    if (!socketsMetaData.hasOwnProperty(input.orgId)) {
        socketsMetaData[input.orgId] = {};
    }
    socketsMetaData[input.orgId][input.type + input.originalOrgUserMappingId] = socketsMetaData[input.orgId][input.type + input.originalOrgUserMappingId] || {};
    socketsMetaData[input.orgId][input.type + input.originalOrgUserMappingId].token = token;
  });
  client.on('messages', function (data) {
    console.log("on messages event from socket");

    client.emit('broad', data);
  });
  client.on('captureVitals', function (data) {
    console.log("on messages event from socket",data);

    client.broadcast.emit('vitalsHandler', data);
  });
  client.on('startGoogleCloudStream', function (data) {
    console.log("on startGoogleCloudStream event from socket");

    startRecognitionStream(this, data);
  });

    client.on('callReceivedFromKiosk', function (data) {
      console.log("callReceivedFromKiosk==========",data)
     // console.log(client)
      client.broadcast.emit('callReceivedFromKioskDoctor', data);
    }); 
    client.on('CallRejectedForKiosk', function (data) {
      console.log("CallRejectedForKiosk==========",data)
     // console.log(client)
      client.broadcast.emit('CallRejectedForKioskDoctor', data);
    }); 
    client.on('onConferenceTerminated', function (data) {
      console.log("onConferenceTerminated==========",data)
     // console.log(client)
      client.broadcast.emit('onConferenceTerminatedDoctor', data);
    }); 
    client.on('onConferenceTerminatePatient', function (data) {
      console.log("onConferenceTerminatePatient==========",data)
     // console.log(client)
      client.broadcast.emit('onConferenceTerminatedPatient', data);
    }); 
    client.on('callStartKioskDoctor', function (data) {
      console.log("callStartKioskDoctor==========",data)
     // console.log(client)
      client.broadcast.emit('StartDoctorCall', data);
    });     
    client.on('callAcceptedkiosk', function (data) {
      console.log("callAcceptedkioskDoctor==========",data)
     // console.log(client)
      client.broadcast.emit('callAcceptedkioskDoctor', data);
    });          
  client.on('endGoogleCloudStream', function (data) {
    stopRecognitionStream();
  });

  client.on('binaryData', function (data) {
    console.log("on binarydata event from socket");

    if (recognizeStream !== null) {
      recognizeStream.write(data);
    }
  });

  client.on("restartStream", function (data) {
    console.log("on restartstream event from socket");

    stopRecognitionStream();
    startRecognitionStream(client);
  })

  function startRecognitionStream(client, data) {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', console.error)
      .on('data', data => {
        process.stdout.write(
          data.results[0] && data.results[0].alternatives[0]
            ? `Transcription: ${data.results[0].alternatives[0].transcript} ${data.results[0].isFinal} ${data.results[0].stability}\n`
            : `\n\nReached transcription time limit, press Ctrl+C\n`
        );
        data.results.forEach(result => {
          result.timeStamp = new Date();
        });

        if (data.results[0].stability == 0 || data.results[0].stability > 0.8)
          client.emit('speechData', data);

        // if end of utterance, let's restart stream
        // this is a small hack. After 65 seconds of silence,
        // the stream will still throw an error for speech length limit
        if (data.results[0] && data.results[0].isFinal) {
          stopRecognitionStream();
          startRecognitionStream(client);
          // //console.log('restarted stream serverside');
        }
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }

/////////////////////////////////////////////Socket code for doctor/////////////////////////////////
  
client.on('initiateCall', async function (data) {
  console.log("initiateCall event from socket");
  let localRequest = {
    headers: { token: data.token },
    url: 'fromSocket',
    body: { ...client.request._query }
  };
  let res = {};
 let authMiddle = await commonUtil.authenticationMiddleware(localRequest, res, function () {
  });
  // console.log("authMiddle",authMiddle);

  var input = localRequest.body;
  input['appointmentId'] = data.appointmentId;
  input['patientId'] = data.patientId;
  if (!sockets.hasOwnProperty(input.orgId)) {
    sockets[input.orgId] = {};
    sockets[input.orgId][input.type + input.originalOrgUserMappingId] = client;
  }
  
  appointmentService.initiateCallWithDoctor(input,res)
});

client.on('callAcceptedByDoc', async function (data) {
  console.log("callAcceptedByDoc event from socket");
  // let localRequest = {
  //   headers: { token: data.token },
  //   url: 'fromSocket',
  //   body: { ...client.request._query }
  // };
  // let res = {};
  // await commonUtil.authenticationMiddleware(localRequest, res, function () {
  //   //console.log('letss see');
  // });
  // var input = localRequest.body;
  // if (!sockets.hasOwnProperty(data.doctorSocketId)) {
  //   sockets[input.orgId] = {};
  //   sockets[input.orgId][input.type + input.originalOrgUserMappingId] = client;
  // }
  var socket = sockets[data.orgId];
  socket[data.nurseSocketId].emit("callAccepted",
    data
  );
  
});

client.on('callRejectedByDoc', async function (data) {
  console.log("callRejectedByDoc event from socket");
  // let localRequest = {
  //   headers: { token: data.token },
  //   url: 'fromSocket',
  //   body: { ...client.request._query }
  // };
  // let res = {};
  // await commonUtil.authenticationMiddleware(localRequest, res, function () {
  //   //console.log('letss see');
  // });
  // var input = localRequest.body;
  // if (!sockets.hasOwnProperty(data.doctorSocketId)) {
  //   sockets[input.orgId] = {};
  //   sockets[input.orgId][input.type + input.originalOrgUserMappingId] = client;
  // }
  var socket = sockets[data.orgId];
  data['msg']  = "Call ended!"
  try {
    socket[data.nurseSocketId].emit("callRejected",
      data
    );
  } catch(e) {
    //console.log(e);
  }
  
});

  client.on("callRejectedByNurse", async function(data) {
    console.log("callRejectedByNurse event from socket");
      let localRequest = {
        headers: { token: data.token },
        url: 'fromSocket',
        body: { ...client.request._query }
      };
      let res = {};
      if(data.doctorSocketId == undefined || data.doctorSocketId == null) {
        await commonUtil.authenticationMiddleware(localRequest, res, function () {
        });
      }
      
      var input = localRequest.body;
      if(data.doctorSocketId == undefined || data.doctorSocketId == null) {
        data['doctorSocketId'] = "Doctor" + input.orgUserMappingId;
      }
    // var socket;
    // if (!sockets.hasOwnProperty(input.orgId)) {
    //   sockets[input.orgId] = {};
    //   sockets[input.orgId][input.type + input.originalOrgUserMappingId] = client;
    // } else {
      var socket;
      if(data.orgId == undefined || data.orgId == null) {
        data["orgId"] = input.orgId;
      }
        socket = sockets[data.orgId];
    // }
    try {
      socket[data.doctorSocketId].emit("callRejectedByNurseAfterCall", {
        msg: "Call ended!"
      });
    } catch(e) {
      //console.log("Something seriously went wrong!!");
    }
  });

});

// CORS middleware
app.use(function (req, res, next) {
  if (req.url == '/heartbeat') {
    next();
    return;
  }
  //console.log("Something seriously went wrong cors!!");

  var allowedOrigins = ['*'];
  if (
    typeof req.headers.origin != 'undefined' &&
    req.headers.origin != '' &&
    req.headers.origin != null
  ) {
    if (allowedOrigins.indexOf(req.headers.origin) > -1) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      // //console.log('request not allowed in allowedOrigins .....')
    }
    // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Request-Headers', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, token, timezoneoffset'
    );
    res.setHeader('Keep-Alive', 'timeout=5, max=500');
    res.setHeader('Server', 'Blockstein Server');
    res.setHeader('Developed-By', 'IgN!TiON1!');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  } else {
    //console.log('into else case of CORS ....' + req.url, req.headers);
    next();
  }
});

// routes loading...
app.use(require('./controllers'));
/**
 * for uncaughtException log
 */
process.on('uncaughtException', function (err, res) {
  console.log('Caught exception: ', err);
  //console.log(err.statusCode, err.message, err.stack);
});
/**
 * NO PAGE FOUND
 */
app.get('*', function (req, res) {
  res.status(404).send('404 page not found');
});

server.listen(`${process.env.PORT}`, '0.0.0.0', function (err, res) {
  console.log(`app MVC listening on ${process.env.PORT}`);
});

getSocketForOrg = function (input) {
  return sockets[input.orgId];
};

getSocketMetaData = function (input) {
    if ("orgId" in input &&
        "type" in input &&
        "orgUserMappingId" in input) {
        let typeString = input.type + input.orgUserMappingId;
        if (input.orgId in socketsMetaData) {
            if (typeString in socketsMetaData[input.orgId]) {
                return socketsMetaData[input.orgId][typeString];
            }
        }
    }
}

exports.inputOutput = io;
exports.getSocketForOrg = getSocketForOrg;
exports.getSocketMetaData = getSocketMetaData;