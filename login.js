var fs = require('fs');
var ini = require('ini');
var login = require('facebook-chat-api');
var moment = require('moment')
var $ = require('jquery')

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
var api;
var currentThreadID;
var currentUserID;
var idMappings = {};

console.log('logging in')

login({email: config.user.email, password: config.user.password}, function(err, fbapi) {
	if (err) return console.error(err);
	console.log('logged in successfully')
	api = fbapi;
	api.setOptions({
		selfListen: true,
		listenEvents: true,
		// updatePresence: true,
	})
	currentUserID = api.getCurrentUserID();
	loadThreads();
	startListening();
})

function startListening() {
	api.listen()
}

function getUser(uid, callback) {
	api.getUserInfo(uid, function(err, obj) {
		if (err) return console.error(err);
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				callback(obj[prop])
			} 
		}
	})
}

function loadThreads() {
	clearThreads();
	api.getThreadList(0, 100, 'inbox', function(err, arr) {
		if (err) return console.error(err);
		// console.log(arr);
		addThreadDiv(arr, 0);
	});
}

function getThreadInfoUsers(threadID, snippetID, callback) {
	api.getUserInfo([threadID, snippetID], function(err, obj) {
		if (err) return console.error(err);
		callback(obj[threadID], obj[snippetID])
	})
}

function addThreadDiv(arr, i) {
	if (i == arr.length) return;
	var thread = arr[i]
	function add(thread_user, snippet_user) {
		name = (currentUserID == thread.snippetSender) ? 'You' : snippet_user.firstName;
		$('#threads').append(
			'<div class="thread" id="' + thread.threadID +'" onclick="setCurrentThread(' + thread.threadID + ')">' +
				'<div class="thread-name">' +
					thread_user.name + 
				'</div><br />' +
				'<div class="last-message">' +
					(thread.snippetHasAttachment ? name + ' sent an attachment' : name + ': ' + thread.snippet) + 
				'</div><br />' +
			'</div>' +
			'<div class="divider"></div>'
		)
		addThreadDiv(arr, i + 1)
	}
	if (!thread.name) {
		getThreadInfoUsers(thread.threadID, thread.snippetSender, add)
	} else getUser(thread.snippetSender, function(user) {add({name: thread.name}, user)});
}

function loadCurrentThread() {
	console.log('getting thread info')
	api.getThreadInfo(currentThreadID, function(err, info) {
		if (err) return console.error(err);
		console.log('getting user info for ' + info.participantIDs.length + ' participants')
		api.getUserInfo(info.participantIDs, function(err, obj) {
			if (err) return console.error(err);
			for (var prop in obj) {
				if (obj.hasOwnProperty(prop)) idMappings[prop] = obj[prop];
			}
			console.log('getting thread history');
			api.getThreadHistory(currentThreadID, 0, 100, null, function(err, history) {
				if (err) return console.error(err);
				console.log('got ' + history.length + ' messages')
				for (var i = 0; i < history.length; i++) {
					addMessageDiv(history[i]);
				}
				scrollToBottom();
			})
		})
	}) 
}

function addMessageDiv(message) {
	var isCurrentUser = (message.senderID.split(':')[1] == currentUserID);
	$('#messages').append(
		'<div class="message' + 
			((isCurrentUser) ? ' self' : '') +
			((message.unsent) ? ' unsent' : '') +
			(message.id ? '" id="' + message.id : '') + '">' + 
			'<div class="sender">' +
				((isCurrentUser) ? 'You' : message.threadName) +
			'</div>' +
			'<div class="body">' +
				message.body + 
			'</div>' +
			// '<div class="timestamp">' +
			// 	moment(message.timestamp).calendar() +
			// '</div>' + 
		'</div>'
	)
}

function sendMessage(m) {
	// use UNIX timestamp as a unique identifier to refer to the message when it gets sent
	ts = moment().format('x')
	console.log(ts)
	message = {
		body: m,
		senderID: 'fbid:' + currentUserID,
		threadName: 'You',
		unsent: true,
		id: ts,
	}
	addMessageDiv(message);
	scrollToBottom();
	api.sendMessage({body: m}, currentThreadID, function(err) {
		if (err) return console.error(err);
		console.log(ts)
		$('#' + ts).removeClass('unsent');
	})
}

$('#message-input').on('keyup', function (e) {
    if (e.keyCode == 13) {
        sendMessage($(this).val())
        $(this).val('')
    }
});

function scrollToBottom() {
	$('#messages').scrollTop($('#messages')[0].scrollHeight)
}

function clearMessages() {
	console.log('clearing messages')
	$('#messages').empty()
}

function clearThreads() {
	console.log('clearing threads')
	$('#threads').empty()
}

function setCurrentThread(threadID) {
	console.log('setting thread to ' + threadID)
	currentThreadID = threadID;
	clearMessages();
	return loadCurrentThread();
}
