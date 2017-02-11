var fs = require('fs');
var ini = require('ini');
var login = require('facebook-chat-api');
var moment = require('moment')
var $ = require('jquery')

var app = require('electron').remote; 
var dialog = app.dialog;

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
var api;
var currentThreadID;
var currentUserID;
var searchBoxState = false;
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

function sendPhoto(caption) {
	dialog.showOpenDialog(function(fileNames) {
       	if (fileNames === undefined) {
            console.log("No file selected");
       	} else {
       		files = []
       		for (var i = 0; i < fileNames.length; i++) {
	       		files.push(fs.createReadStream(fileNames[i]))
       		}
            api.sendMessage(
            	{
            		body: caption ? caption : '',
            		attachment: files
            	},
            	currentThreadID,
            	function(err, info) {
            		if (err) return console.error(err);
            	}
            );
       	}
	});
}

function startListening() {
	api.listen(function(err, message) {
		if (err) return console.error(err);
		var isSelf = (message.senderID == currentUserID)
		getUser(message.senderID, function(err, sender) {
			if (err) return console.error(err);
			message.sender = sender
			message.threadName = sender.name
			switch (message.type) {
				case 'message':
					var name = (isSelf ? 'You' : sender.firstName )
					var selector = '#' + message.threadID
					if (!(message.threadID == currentThreadID || isSelf)) {
						$(selector + ' *').addClass('unread')
					}
					$(selector + '>.last-message').text(message.attachments.length > 0 ? name + ' sent an attachment' : name + ': ' + message.body)
					$(selector + ',' + selector + '+div').prependTo('#threads')
					if (!$('#' + message.messageID.split(':')[1]).length && message.threadID == currentThreadID) {
						addMessageDiv(message);
						scrollToBottom();
					}
				break
			} 
		})
	})
}

function getUser(uid, callback) {
	api.getUserInfo(uid, function(err, obj) {
		if (err) {return console.error(err)};
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				callback(err, obj[prop])
			} 
		}
	})
}

function loadThreads() {
	clearThreads();
	api.getThreadList(0, 100, 'inbox', function(err, arr) {
		if (err) return console.error(err);
		addThreadDiv(arr, 0);
	});
}

function getThreadInfoUsers(threadID, snippetID, callback) {
	api.getUserInfo([threadID, snippetID], function(err, obj) {
		if (err) return console.error(err);
		callback(obj[threadID], obj[snippetID])
	})
}

function getUsers(users, callback) {
	api.getUserInfo(users, function(err, obj) {
		if (err) return console.error(err);
		callback(err, obj)
	})
}

function findUser(text) {
	api.getUserID(text, function(err, obj) {
		if (err) return console.error(err);
		console.log(text, obj[0])
		setCurrentThread(obj[0].userID);
	});
}

$(document).keydown(function(e) {
    if (e.keyCode == 78) {
    	if (!searchBoxState && e.ctrlKey) {
	    	openSearchBox();
    	}
    } else if (e.keyCode == 27) {
    	if (searchBoxState) {
    		closeSearchBox();
		}
	} else {
		// console.log(e)
	}
});

function openSearchBox() {
	searchBoxState = true;
	$('#search-box input').val('');
	$('#search-box').css('opacity', 1);
	$('#search-box input').focus();
}

function closeSearchBox() {
	searchBoxState = false
	$('#search-box').css('opacity', 0)
	$('#message-input input').focus()
}

$('#search-box input').keydown(function(e) {
	if (e.keyCode == 13) {
		findUser($(this).val());	
		closeSearchBox();		
	}
})

function addThreadDiv(arr, i) {
	if (i == arr.length) return;
	var thread = arr[i]
	function add(thread_user, snippet_user) {
		name = (currentUserID == thread.snippetSender) ? 'You' : snippet_user.firstName;
		$('#threads').append(
			'<div class="thread' + (thread.unreadCount ? ' unread' : '') + '" id="' + thread.threadID +'" onclick="setCurrentThread(' + thread.threadID + ')">' +
				'<div class="thread-name' + (thread.unreadCount ? ' unread' : '') + '">' +
					thread_user.name + 
				'</div><br />' +
				'<div class="last-message' + (thread.unreadCount ? ' unread' : '') + '">' +
					(thread.snippetHasAttachment ? name + ' sent an attachment' : name + ': ' + thread.snippet) + 
				'</div><br />' +
			'</div>' +
			'<div class="divider"></div>'
		)
		if (i + 1 >= arr.length) $('#top-bar').text(thread) // this isn't working
		addThreadDiv(arr, i + 1)
	}
	if (!thread.name) {
		if (thread.participants.length > 2) {
			getUsers(thread.participantIDs, function(err, users) {
				names = [];
				for (x in users) {
					if (users.hasOwnProperty(x)) {
						names.push(users[x].firstName)
					}
				}
				add({name: names.join(', ')}, users[thread.snippetSender])
			});
		} else {
			getThreadInfoUsers(thread.threadID, thread.snippetSender, add)
		}
	} else getUser(thread.snippetSender, function(err, user) {add({name: thread.name}, user)});
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
				markThreadAsRead(currentThreadID)
				$('#input input').focus();
			})
		})
	})
}

function markThreadAsRead(threadID) {
	api.markAsRead(threadID, function(err) {
		if (err) return console.error(err)
		$('#' + threadID + ' *').removeClass('unread');
	});
}

function addMessageDiv(message) {
	var isCurrentUser = ((message.senderID[0] == 'f' ? message.senderID.split(':')[1] : message.senderID) == currentUserID);
	attachment_html = []
	for (a in message.attachments) {
		if (message.attachments.hasOwnProperty(a)) {
			attachment = message.attachments[a]
			switch (attachment.type) {
				case 'sticker':
					attachment_html.push(
						'<img class="sticker" src="' + attachment.url + '">'
					)
				break
				case 'photo':
					attachment_html.push(
						'<img class="photo" src="' + attachment.previewUrl + '">'
					)
				break
			}
		}
	}

	$('#messages').append(
		'<div class="message' + 
			((isCurrentUser) ? ' self' : '') +
			((message.unsent) ? ' unsent' : '') + '" ' + 
			(message.messageID ? 'id="' + message.messageID.split(':')[1] : 'id="' + message.id ) + '">' + 
			'<div class="sender">' +
				((isCurrentUser) ? 'You' : message.threadName) +
			'</div>' +
			'<div class="body">' +
				message.body + 
			'</div>' +
			attachment_html.join('') +
			// '<div class="timestamp">' +
			// 	moment(message.timestamp).calendar() +
			// '</div>' + 
		'</div>'
	)
}

function sendMessage(m) {
	// use UNIX timestamp as a unique identifier to refer to the message when it gets sent
	ts = moment().format('x')
	message = {
		body: m,
		senderID: 'fbid:' + currentUserID,
		threadName: 'You',
		unsent: true,
		id: ts,
	}
	addMessageDiv(message);
	scrollToBottom();
	api.sendMessage({body: m}, currentThreadID, function(err, info) {
		if (err) return console.error(err);
		$('#' + ts).removeClass('unsent');
		$('#' + ts).attr('id', info.messageID.split(':')[1]);
	})
}

$('#message-input').on('keyup', function (e) {
    if (e.keyCode == 13) {
        sendMessage($(this).val())
        $(this).val('')
    }
});

function scrollToBottom() {
	setTimeout(function() {
		$('#messages').scrollTop($('#messages')[0].scrollHeight)
	}, 300)
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
