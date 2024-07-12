var session = require('express-session')
var id;
ObjectId = require('mongodb').ObjectID;
var bcrypt = require('bcrypt');
ObjectId = require('mongodb').ObjectID;
const saltRounds = 10;
var express = require('express')
  , app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);
server.listen(8080);
const bodyParser= require('body-parser');
const mongo = require('mongodb').MongoClient;
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
// routing
//Main menu route
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/mainmenu.html');
  });

//Chat route + Getting rooms from database
  app.get('/chat', function (req, res) {
	rooms = [];
	roomname = [];
	console.log("id is set to " + req.query.id);
	currentserver = req.query.id;
	db.collection("rooms").find({serverparent: req.query.id}).project({roomname:1,_id:1}).toArray(function(err, result) {
		if (err) throw err;
		console.log(result);
		for(i = 0; i<result.length; i++){
		console.log(result[i]._id);
		roomname.push(result[i].roomname);
		rooms.push(result[i]._id);
		}
		db.collection("rooms").find({serverparent: req.query.id}).toArray(function(err, result) {
		
		res.render('index.ejs', {currentserver: result})
		});
		
		});
		
  });
  //Add a room Route
app.get('/rooms', function (req, res) {
	console.log("id is set to " + req.query.id);
	db.collection('servers').find({servername:req.query.id}).toArray(function(err, results) {
		console.log(results);
		// send HTML file populated with quotes here
		res.render('rooms.ejs', {currentserver: results})
	});
});
app.get('/register', function (req, res) {
	res.sendfile(__dirname + '/register.html');
});
app.get('/login', function (req, res) {
	res.sendfile(__dirname + '/login.html');
});
app.post('/quotes', (req, res) => {
	db.collection('rooms').save(req.body, (err, result) => {
		if (err) return console.log(err)
		console.log('Room saved to database')
		res.redirect('/serverbrowser')
	  });
	});  
app.get('/serverbrowser', function (req, res) {

	db.collection('useraccess').find({userid:ObjectId(id)}).toArray(function(err, find) {
		if(find[0] == null){
			res.sendfile(__dirname + '/servermenu.html');
		}else{
			var id_server;
			db.collection('useraccess').find({userid:ObjectId(id)}).project({serverid:1, _id:0}).toArray(function(err, server_id) {
				id_server = server_id[0].serverid;
				console.log(id_server);

				db.collection('servers').find({_id:id_server}).toArray(function(err, results) {
					console.log(results);
					// send HTML file populated with quotes here
					db.collection('users').find({_id:ObjectId(id)}).project({username:1, _id:0}).toArray(function(err, username) {
						
						res.render('serverbrowser.ejs', {quotes: results,user_id:username[0].username})
			
					});
					
				});
				
			});
			
		}
});

});
app.get('/addserver', function (req, res) {
	res.sendfile(__dirname + '/addserver.html');
});
app.post('/serversave', (req, res) => {
	db.collection('servers').save(req.body, (err, result) => {
		if (err) return console.log(err)
		var defaultRoom = {
			roomname: 'General',
			serverparent: req.body.servername,
			type: 'Public',
		}
		db.collection('rooms').save(defaultRoom, (err, result) => {
			if (err) return console.log(err)
			console.log('Default Room saved to database')
			});
			db.collection('servers').find({servername:req.body.servername}).project({servername:1, _id:0}).toArray(function(err, servername) {
				db.collection('servers').find({servername:req.body.servername}).project({_id:1}).toArray(function(err, serverid) {
					var useraccess = {
						userid: ObjectId(id),
						servername:servername[0].servername,
						serverid:serverid[0]._id,
						role:'admin',
					}
					db.collection('useraccess').save(useraccess, (err, result) => {
					if (err) return console.log(err)
					console.log('User access saved to database')
					});
				});
			});
			
		console.log('Server saved to database')
		res.sendfile(__dirname + '/index.html');
	  })
  });

let chat;
var db;
var currentserver;


mongo.connect('mongodb://127.0.0.1/mongogc', function(err, client){
    if(err){
        throw err;
	}
	 chat = client.db('mongogc').collection('chats');
	db = client.db('mongogc');
	app.listen(3000, () => {
		console.log('listening on 3000')
	  });
	console.log('MongoDB connected...');
});




// usernames which are currently connected to the chat
var usernames = {};

// rooms which are currently available in chat

var rooms = [];
var roomname =[];

io.sockets.on('connection', function (socket) {
	
	// when the client emits 'adduser', this listens and executes
	socket.on('adduser', function(username){
		// store the username in the socket session for this client
		socket.username = username;
		// store the room name in the socket session for this client
		db.collection("rooms").find({serverparent: currentserver, roomname: 'General'}).toArray(function(err, result) {
			console.log(result);
			socket.room = result[0]._id;
			usernames[username] = username;
			socket.join(result[0]._id);
			socket.broadcast.to(result[0]._id).emit('updatechat', 'SERVER', username + ' has connected to this room');
		});
		// socket.room = 'General';
		// add the client's username to the global list
		// send client to room 1
		// socket.join('General');
		// echo to client they've connected
		socket.emit('updatechat', 'SERVER', 'you have connected to General');
		chat.find({room: socket.room, server: currentserver}).limit(100).sort({_id:1}).toArray(function(err, res){
			socket.emit('updaterooms', rooms, 'General',res, roomname);
		});
		// echo to room 1 that a person has connected to their room
		
	});
	
	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data, currentserver) {
		// we tell the client to execute 'updatechat' with 2 parameters
		chat.insert({name: socket.username, message: data, room: socket.room, server: currentserver}, function(){
			console.log("Chat Recorded!");
		});
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
	});
	
	socket.on('switchRoom', function(newroom){
		socket.leave(socket.room);
		socket.join(newroom);
		db.collection("rooms").find({_id: ObjectId(newroom)}).project({roomname:1,_id:1}).toArray(function(err, result) {
		socket.emit('updatechat', 'SERVER', 'you have connected to ' + result[0].roomname);
		});
		// sent message to OLD room
		// update socket session room title
		socket.room = newroom;
		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
		chat.find({room: socket.room, server: currentserver}).limit(100).sort({_id:1}).toArray(function(err, res){
			socket.emit('updaterooms', rooms, newroom, res, roomname);
		});
		
	});
	

	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		// remove the username from global usernames list
		delete usernames[socket.username];
		// update list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		socket.leave(socket.room);
	});
});

//auth

var mongoose = require('mongoose');
var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  passwordConf: {
    type: String,
    required: true,
  }
});
var User = mongoose.model('User', UserSchema);
module.exports = User;

app.post('/submit', (req, res) => {
	if (req.body.email &&
		req.body.username &&
		req.body.password &&
		req.body.passwordConf && (req.body.password === req.body.passwordConf)) {

			//hashing a password before saving it to the database
			const hashed = req.body.password;

bcrypt.hash(hashed, saltRounds, function(err, hash) {
	// Store hash in your password DB.
	var userData = {
		email: req.body.email,
		username: req.body.username,
		password: hash,
	  }

	  db.collection('users').save(userData, (err, result) => {
		  console.log(result);
		  return redirect('/login');
	  });
  });
		
	  }else{
		console.log('may mali');
		return redirect('/register');
	  }

});

//use sessions for tracking logins
app.use(session({
	secret: 'session',
	resave: false,
	saveUninitialized: false
  }));

app.post('/logged', (req, res) => {

	if (req.body.email && req.body.password){

			db.collection("users").find({email: req.body.email}).	project({email:1, _id:0}).toArray(function(err, result) {
				if(result){
					db.collection("users").find({email: req.body.email}).	project({password:1, _id:0}).toArray(function(err, hash) {
					// Load hash from your password DB.
					bcrypt.compare(req.body.password, hash[0].password).then(function(compared) {
						if(compared){
							db.collection("users").find({email: req.body.email}).	project({_id:1}).toArray(function(err, user_id) {
								req.session.users = user_id[0]._id;
								id = req.session.users;
								console.log(id);
								console.log('tama password');
								return res.redirect('/serverbrowser');	
							});
						}else{
							console.log('mali password');
							return redirect('/login');	
						}
					});
				});
				}
				
			});
			
		}
});

