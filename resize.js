$(window).resize(resizeContent)

function resizeContent() {
	$('#messages').height($(window).height() - $('#input').height() - 72)
	$('#threads').height($(window).height() - 52)
}

resizeContent()