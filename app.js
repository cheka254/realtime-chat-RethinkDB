console.log("Setting up dependencies...");
var app = require('express')();
var server = require("http").createServer(app);
var async = require('async');
var io = require('socket.io')(server);
var r = require('rethinkdbdash')();
var bodyParser = require('body-parser');

console.log("Done!");

// console.log("Connect to RethinkDB!!");
// var connection = null;
// r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
//     if (err) throw err;
//     connection = conn;
//     console.log("Done!!");
// });

console.log("Setup databases if they don't already exist...");
async.waterfall([
  function(finished) {
    r.dbList().contains('messages_db')
      .run()
      .then(function(result) {
        finished(null, result)
      })
      .error(function(err) {
        finished(err);
      })
  },
  function(dbExists, finished) {
    if (dbExists == false) {
      r.dbCreate('messages_db')
        .run()
        .then(function() {
          finished(null);
        })
        .error(function(err) {
          finished(err);
        });
    } else {
      finished(null);
    }
  },
  function(finished) {
    r.db('messages_db').tableList().contains('messages')
      .run()
      .then(function(result) {
        finished(null,result);
      })
      .error(function(err) {
        finished(err);
      });
  },
  function(tableExists, finished) {
    if (tableExists == false) {
      r.db('messages_db').tableCreate('messages')
        .run()
        .then(function(result) {
          finished(null, false);
        })
        .error(function(err) {
          finished(err);
        })
    } else {
      finished(null, true);
    }
  },
  function(tableIndexed, finished) {
    if (tableIndexed == false) {
      r.db('messages_db').table('messages').indexCreate('date')
        .run()
        .then(function(result) {
          finished(null);
        })
        .error(function(err) {
          finished(err);
        })
    } else {
      finished(null);
    }
  }
], function(err) {
  if (err) throw err;
});
console.log("Done...");

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Set send rest API
console.log("Setup Send Message REST API..");
app.post('/message/send', function(req,res,next) {
  console.log("New message incoming!!");
  var message = req.body.message;
  r.db('messages_db').table('messages')
    .insert({
      message: message,
      date: new Date()
    })
    .run()
    .then(function(result) {
      res.send('Message sent!');
    })
    .error(function(err) {
      res.status(500).send('Internal Server Error');
    })
});
console.log("Done..");

  
console.log("Setup get all messages REST API");
app.get('/message/all', function(req,res,next) {
  r.db('messages_db').table('messages')
    .orderBy({index: r.asc('date')})
    .run()
    .then(function(result) {
      res.send(result);
    })
    .error(function(err) {
      res.status(500).send('Internal Server Error');
    })
});
console.log("Done");
  
//Create socket.io event
console.log("Setup socket.io connection.....");
io.on('connection', function(socket) {
  console.log('New client connected');
})
console.log("Done.....");

  
  
console.log("Setup socket.io emitter!!!!");
r.db('messages_db').table('messages')
.changes()
.run()
.then(function(cursor) {
  cursor.each(function(err, result) {
    console.log(result);
    io.emit('new_message', result);
  });
});
console.log("Done!!!!");

process.on('uncaughtException', function(err) {
  console.log(err);
})

//Serve the static html page.
var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || process.env.PORT || process.argv[2] || 80;
server.listen(port);


app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});