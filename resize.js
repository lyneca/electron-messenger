$(window).resize(resizeContent)

function resizeContent() {
	$('#messages').height($(window).height() - $('#input').height() - 65)
}

resizeContent()