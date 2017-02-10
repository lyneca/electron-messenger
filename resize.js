$(window).resize(resizeContent)

function resizeContent() {
	$('#messages').height($(window).height() - $('#input').height() - 40)
}

resizeContent()