/* jslint browser: true */
/* global Textual */

/* Defined in: "Textual.app -> Contents -> Resources -> JavaScript -> API -> core.js" */

var mappedSelectedUsers = new Array();
var previousNick = ''; previousNickCount = 1;

var NickColorGenerator = (function () {
    function NickColorGenerator(message) {
        //Start alternative nick colouring procedure
        var selectNick = message.querySelector(".sender");
        selectNick.removeAttribute('colornumber');
        var nickcolor = this.generateColorFromHash(selectNick.getAttribute('nickname'));

        if ((previousNick === selectNick.innerHTML) && (previousNickCount < 10)) {
          selectNick.style.visibility = "hidden";
          previousNickCount += 1;
        } else {
          selectNick.style.color = nickcolor;
          previousNick = selectNick.innerHTML;
          previousNickCount = 1;
        }

        var inlineNicks = message.querySelectorAll('.inline_nickname');
        if (message.getAttribute('ltype') == 'action') {
            message.querySelector(".message").style.color = nickcolor;
        }
        for (var i = 0, len = inlineNicks.length; i < len; i++) {
            inlineNicks[i].removeAttribute('colornumber');
            var nick = inlineNicks[i].innerHTML;
            if (inlineNicks[i].getAttribute('mode').length > 0) {
                nick = nick.replace(inlineNicks[i].getAttribute('mode'), '');
            }
            inlineNicks[i].style.color = this.generateColorFromHash(nick);
        }
    }
    NickColorGenerator.prototype.sanitiseNickname = function (nick) {
        // attempts to clean up a nickname
        // by removing alternate characters from the end
        // nc_ becomes nc, avidal` becomes avidal
        nick = nick.toLowerCase();
        // typically ` and _ are used on the end alone
        nick = nick.replace(/[`_]+$/, '');
        // remove |<anything> from the end
        nick = nick.replace(/|.*$/, '');
        return nick;
    };

    NickColorGenerator.prototype.generateHashFromNickname = function (nick) {
        var cleaned = this.sanitiseNickname(nick);
        var h = 0;
        for(var i = 0; i < cleaned.length; i++) {
            h = cleaned.charCodeAt(i) + (h << 6) + (h << 16) - h;
        }
        return h;
    };

    NickColorGenerator.prototype.generateColorFromHash = function (nick) {
        var nickhash = this.generateHashFromNickname(nick);
        var deg = nickhash % 360;
        var h = deg < 0 ? 360 + deg : deg;
        var l = Math.abs(nickhash) % 110;

        // don't use the blue hues
        if (h >= 240 && h <= 270) {
          h += 30;
        }
        if (h < 240 && h >= 210) {
          h -= 30;
        }

        // shift the reds into pinks and oranges
        if (h >= 330) {
          h -= 30;
        }
        if (h < 25) {
          h += 25;
        }

        if(h >= 30 && h <= 210) {
            l = 60;
        }
        var s = 20 + Math.abs(nickhash) % 70;
        if (h >= 210 && s >= 80) {
            s = s-30;
        }
        if ((h < 110 && s < 60) || l <= 30) {
            l = l + 40;
        }
        if (l > 90) {
            l = l - 20;
        }

        // if the saturation is really low, bump up the luminance a bit
        if (s < 40) {
          l += 10;
        }

        return "hsl(" + h + "," + s + "%," + l + "%)";
    };
    return NickColorGenerator;
})();

Textual.viewBodyDidLoad = function() {
    Textual.fadeOutLoadingScreen(1.00, 0.95);

    setTimeout(function() {
        Textual.scrollToBottomOfView();
    }, 500);
};

Textual.newMessagePostedToView = function (line) {
    var message = document.getElementById('line-' + line);
	if (message.getAttribute('ltype') === 'privmsg' || message.getAttribute('ltype') === 'action') {
        new NickColorGenerator(message);
    }
    if (message.getAttribute("encrypted") === "true") {
        var messageText = message.querySelector(".innerMessage");
        if (messageText.innerText.indexOf("+OK") !== -1) {
            message.setAttribute("encrypted", "failed");
        }
    }
    var getEmbeddedImages = message.querySelectorAll("img");
    if (getEmbeddedImages) {
        for (var i = 0, len = getEmbeddedImages.length; i < len; i++) {
            getEmbeddedImages[i].onload = function(e) {
                setTimeout(function() {
                    if (e.target.offsetHeight > (window.innerHeight - 150)) {
                        e.target.style.height = (window.innerHeight - 150);
                    }
                }, 1000);
            }
        }
    }
    updateNicknameAssociatedWithNewMessage(message);
};

Textual.nicknameSingleClicked = function(e) {
    userNicknameSingleClickEvent(e);
}

Textual.notifyDidBecomeVisible = function()
{
  window.getSelection().empty();
};


function updateNicknameAssociatedWithNewMessage(e) {
	/* We only want to target plain text messages. */
	var elementType = e.getAttribute("ltype");
    var acceptedElementTypes = ["privmsg", "action", "notice"];
	if (acceptedElementTypes.indexOf(elementType) !== -1) {
		/* Get the nickname information. */
		var senderSelector = e.querySelector(".sender");
		if (senderSelector) {
			/* Is this a mapped user? */
			var nickname = senderSelector.getAttribute("nickname");

			/* If mapped, toggle status on for new message. */
			if (mappedSelectedUsers.indexOf(nickname) > -1) {
				toggleSelectionStatusForNicknameInsideElement(senderSelector);
			}
		}
	}
}

function toggleSelectionStatusForNicknameInsideElement(e) {
	/* e is nested as the .sender so we have to go three parents
	 up in order to reach the parent div that owns it. */
	var parentSelector = e.parentNode.parentNode.parentNode.parentNode;

	parentSelector.classList.toggle("selectedUser");
}

function userNicknameSingleClickEvent(e) {
	/* This is called when the .sender is clicked. */
	var nickname = e.getAttribute("nickname");
	/* Toggle mapped status for nickname. */
	var mappedIndex = mappedSelectedUsers.indexOf(nickname);

	if (mappedIndex == -1) {
		mappedSelectedUsers.push(nickname);
	} else {
		mappedSelectedUsers.splice(mappedIndex, 1);
	}

	/* Gather basic information. */
    var documentBody = document.getElementById("body_home");

    var allLines = documentBody.querySelectorAll('div[ltype="privmsg"], div[ltype="action"]');

	/* Update all elements of the DOM matching conditions. */
    for (var i = 0, len = allLines.length; i < len; i++) {
        var sender = allLines[i].querySelectorAll(".sender");

        if (sender.length > 0) {
            if (sender[0].getAttribute("nickname") === nickname) {
				toggleSelectionStatusForNicknameInsideElement(sender[0]);
            }
        }
    }
}
