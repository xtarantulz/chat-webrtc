const fs = require("fs");
var express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
app.use(express.static(__dirname + '/public'));
var io = require('socket.io')(server);

var port = process.env.PORT || 80;
server.listen(port, function () {
    console.log('Server start in ' + port);
});

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/:folder/:file", function (req, res) {
    res.sendFile(__dirname + "/public/" + req.params.folder + "/" + req.params.file);
});

var users = {};

io.on('connection', function (socket) {
    socket.on('init', function (data) {
        socket.join(socket.id);
        var user = {
            id: socket.id,
            name: data.name,
            microphone: data.microphone,
            camera: data.camera,
            free: true
        };

        //отправляем кто вошел ему все онлайн список
        socket.emit('users', users);

        //отправляем кто вошел ему последние сообщений
        if (fs.existsSync(__dirname + '/1.txt')) {
            var messages =  fs.readFileSync(__dirname + '/1.txt', 'utf8').split("\n");
            socket.emit('messages', messages);
        }

        //запишем в онлайн список
        users[user.id] = user;

        //всем остальным отправляем его даные что он вошел
        socket.broadcast.emit('add user', user);
    });

    socket.on('message', function (message) {
        if (message.time === undefined) message.time = Math.round(+new Date() / 1000);

        if (message.to.id === undefined) {
            fs.appendFileSync(__dirname + '/1.txt', JSON.stringify(message)+"\n");

            io.sockets.emit('message', message);
        } else {
            socket.broadcast.to(message.to.id).emit('message', message);
            socket.emit('message', message);
        }
    });

    socket.on('offer call', function (data) {
        var f = false;
        if(users[data.to] !== undefined && users[data.from] !== undefined){
            if (users[data.to].free && users[data.from].free) {
                users[data.to].free = false;
                users[data.from].free = false;
                socket.broadcast.to(data.to).emit('offer call', data);

                f = true;
            }
        }

        if(f === false){
            if(users[data.from] !== undefined) users[data.from].free = true;
            socket.emit('finish call');
        }
    });

    socket.on('answer call', function (data) {
        socket.broadcast.to(data.to).emit('answer call', data);
    });

    socket.on('calling', function (data) {
        socket.broadcast.to(data.to).emit('calling', data);
    });

    socket.on('finish call', function (data) {
        if(users[data.to] !== undefined) users[data.to].free = true;
        if(users[data.from] !== undefined) users[data.from].free = true;

        socket.broadcast.to(data.to).emit('finish call', data);
    });

    socket.on('tapping', function (data) {
        if (data.to.id === undefined) {
            socket.broadcast.emit('tapping', data);
        } else {
            socket.broadcast.to(data.to.id).emit('tapping', data);
        }
    });

    //при выхода сокета
    socket.on('disconnect', function () {
        if (socket.id in users) delete users[socket.id];
        socket.broadcast.emit('del user', socket.id);
    });
});
