var fs = require('fs');
var ini = require('ini');
var login = require('facebook-chat-api');
var $ = require('jquery')

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

currentThread = 0

login({email: config.user.email, password: config.user.password}, function(err, api) {
	if (err) return console.error(err);
})

function loadCurrentThread() {

}

function setCurrentThread(threadID) {
	currentThread = threadID;
	loadCurrentThread();
}