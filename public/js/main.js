var socket = io();
var caret = 0;

var name = 'Unidentified Beaver';
var microphone = false;
var camera = false;

var videoPosition,
    mousePosition,
    mouseState = 0;

function getCaretPosition(editableDiv) {
    var caretPos = 0,
        sel, range;
    if (window.getSelection) {
        sel = window.getSelection();
        if (sel.rangeCount) {
            range = sel.getRangeAt(0);
            if (range.commonAncestorContainer.parentNode === editableDiv) {
                caretPos = range.endOffset;
            }
        }
    } else if (document.selection && document.selection.createRange) {
        range = document.selection.createRange();
        if (range.parentElement() === editableDiv) {
            var tempEl = document.createElement("span");
            editableDiv.insertBefore(tempEl, editableDiv.firstChild);
            var tempRange = range.duplicate();
            tempRange.moveToElementText(tempEl);
            tempRange.setEndPoint("EndToEnd", range);
            caretPos = tempRange.text.length;
        }
    }
    return caretPos;
}

function SetCaretPosition(el, pos) {
    try {
        var range = document.createRange();
        var sel = window.getSelection();
        range.setStart(el.childNodes[0], pos);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (e) {
    }

    el.focus();
}

function notifyMe(text) {
    if (!("Notification" in window)) {

    } else if (Notification.permission === "granted") {
        var notification = new Notification(text);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
            if (permission === "granted") {
                var notification = new Notification(text);
            }
        });
    }
}

function showMessage(message) {
    var messageTo = "",
        additionalClass = "",
        wrapperClass = "";

    if (message.to.id) {
        messageTo += "</span> <small>→</small> <span class='to'>" + message.to.name;
        additionalClass = " private";
    }

    if (message.to.id === socket.id) notifyMe(message.from.name + " → " + message.to.name + " : " + message.text);

    if (message.from.id === socket.id) wrapperClass += " my-message";

    var find = /(https?|ftp):\/\/\S+[^\s.,> )\];'\"!?]/;
    var replace = '<a target="_blank" class="fancybox" href="$&">[link]</a>';
    message.text = message.text.replace(new RegExp(find, 'g'), replace);

    var html = '<div class="message-wrapper' + wrapperClass + '"><div class="message-block ' + additionalClass + '"> <span class="from">' + message.from.name + messageTo + ' : </span>  <span class="text">' + message.text + '</span><span class="date">' + getCurrentTime(message.time) + '</span></div></div>';

    $('.chat-div').append(html).stop(true).animate({
        'scrollTop': 1000000000
    }, 1);

    $('.fancybox').fancybox();
}

//получаем все девайсы микро и видео
function gotDevices(devices) {
    for (var i = 0; i !== devices.length; ++i) {
        if (devices[i].kind === 'audioinput') {
            if (devices[i].deviceId !== 'default' && devices[i].deviceId !== 'communications') microphone = true;
        }

        if (devices[i].kind === 'videoinput') camera = true;
    }

    //инициализация
    socket.emit('init', {
        name: name,
        microphone: microphone,
        camera: camera
    });
}

//покажем пользователя в онлайне
function showUserOnline(user) {
    if ((user.microphone || user.camera) && (microphone || camera)) {
        $('.online-div').append("<div id='" + user.id + "' class='user'><i class='fa fa-phone call' aria-hidden='true'></i><i class='fa fa-pencil write' aria-hidden='true'></i>" + user.name + "</div>");
    } else {
        $('.online-div').append("<div id='" + user.id + "' class='user'><i class='fa fa-pencil write' aria-hidden='true'></i>" + user.name + "</div>");
    }
}

function getCurrentTime(time) {
    var date = new Date(time * 1000);

    var day = date.getDay();
    if (day < 10) day = "0" + day;
    var mouth = date.getMonth();
    if (mouth < 10) mouth = "0" + mouth;
    var year = date.getFullYear();

    var hours = date.getHours();
    if (hours < 10) hours = "0" + hours;
    var minutes = date.getMinutes();
    if (minutes < 10) minutes = "0" + minutes;
    var seconds = date.getSeconds();
    if (seconds < 10) seconds = "0" + seconds;

    return day + '.' + mouth + '.' + year + ' ' + hours + ':' + minutes + ':' + seconds;
}

$(document).ready(function () {
    if (!localStorage.userName) {
        $('#login').css({'display': 'flex'});
    } else {
        $('#main').css({'display': 'flex'});
    }

    var message = {
        text: "Видео общение работает только через браузер Мозила",
        from: {
            id: socket.id,
            name: 'Админ (Владимир Батраков)'
        },
        to: {
            id: null,
            name: null
        },
        type: "message",
        time: 1573922460
    };

    showMessage(message);

    //авторизация
    $('#login .login-button').click(function () {
        var nickName = $("#login input.login-input").val();
        if (nickName !== "") {
            localStorage.userName = nickName;
            window.location.replace("./");
        }
    });
    $("#login input.login-input").keydown(function (e) {
        if (e.keyCode === 13) $('#login .login-button').click();
    });


    //смайлы
    var emojRange = [
        [128512, 128591],
        [129296, 129310],
        [129408, 129425],
        [128001, 128178],
        [128640, 128704]
    ];
    for (var i = 0; i < emojRange.length; i++) {
        var range = emojRange[i];
        for (var x = range[0]; x < range[1]; x++)
            $('.smiles-div').append('<span data-c=' + x + '>&#' + x + ';</span>');
        $('.smiles-div').append('<hr />');
    }

    //система запустилась
    if (localStorage.userName) {
        name = localStorage.userName;
        document.title = 'Hi, ' + name + ' || VideoChat';

        //узнаем есть ли микро или камера
        navigator.mediaDevices.enumerateDevices().then(gotDevices); //спрашиваю какие есть девайсы

        //если кто-то зашел то тебе нужно его добавить
        socket.on('add user', function (user) {
            showUserOnline(user)
        });

        //принимаем весь список онлайна до тебя
        socket.on('users', function (users) {
            $.map(users, function (item, index) {
                showUserOnline(item);
            });
        });

        //принимаем весь список сообщений
        socket.on('messages', function (messages) {
            $.map(messages, function (item, index) {
                if (item !== '') showMessage(JSON.parse(item));
            });
        });

        //получение сообщение
        socket.on('message', function (message) {
            showMessage(message);

            if (message.from.id !== socket.id) {
                var audio = new Audio();
                audio.src = '/new_message.mp3';
                audio.autoplay = true;
            }
        });

        socket.on('tapping', function (data) {
            $('.tapping').text(data.from.name + ' is tapping...');
            $('.tapping').stop(true).css({
                'opacity': 1
            }).animate({
                'opacity': 0
            }, 1500);
        });

        $('.online-div').on('click', '.write', function () {
            if (!$(this).hasClass('active')) {
                $('.online-div i.write').removeClass('active');
                $(this).addClass('active');
            } else {
                $('.online-div i.write').removeClass('active');
            }
        });

        $('.text-div>div').keydown(function (event) {
            if (event.keyCode === 13) {
                $('button[type=submit]').click();
                event.preventDefault();
                event.stopPropagation();
            } else {
                var data = {
                    from: {
                        id: socket.id,
                        name: name
                    },
                    to: {
                        id: $('.online-div i.write.active').parent().attr('id'),
                        name: $('.online-div i.write.active').parent().text()
                    }
                };

                socket.emit('tapping', data);
            }
        });

        $('button[type=submit]').click(function () {
            if ($(".text-div>div").text() !== '' || $(".text-div>div").find("img").attr('src')) {
                var text = $('.text-div>div').text();

                if ($(".text-div>div").find("img").attr('src')) {
                    text = text + "<span class='images'>";

                    $('.text-div>div img').each(function () {
                        text = text + "<a class='fancybox img' href='" + $(this).attr('src') + "'><img src='" + $(this).attr('src') + "'></a>";
                    });

                    text = text + "</span>";
                }

                var message = {
                    text: text,
                    from: {
                        id: socket.id,
                        name: name
                    },
                    to: {
                        id: $('.online-div i.write.active').parent().attr('id'),
                        name: $('.online-div i.write.active').parent().text()
                    },
                    type: "message"
                };

                socket.emit('message', message);
                $('.text-div>div').text('');
            }
        });

        $('.smiles-button').click(function () {
            if ($(this).hasClass('active')) {
                $(this).removeClass('active');
                // $('#smilesSection').stop(true).animate({'opacity':0},300,function(){
                $('#smilesSection').slideUp();
                // });
            } else {
                $(this).addClass('active');
                $('#smilesSection').slideDown();
                // $('#smilesSection').stop(true).animate({'opacity':1},300);
            }

            SetCaretPosition(document.getElementById('textInput'), caret);
        });

        $('.text-div>div').bind("mousedown mouseup keydown keyup", function () {
            caret = getCaretPosition(document.getElementById('textInput'));
        });

        $('.smiles-div span').click(function () {
            var text = $('.text-div>div').text();
            text = text.substr(0, caret) + $(this).html() + text.substr(caret);
            $('.text-div>div').text(text);
            caret = caret + 2;
            SetCaretPosition(document.getElementById('textInput'), caret);
        });


        $("#videoSection").mousedown(function (e) {
            var top = $('#main').offset().top;
            mousePosition = e.clientY - top;
            videoPosition = parseInt($('#videoSection').css('top'));
            mouseState = 1;
            $('#videoSection').css('transition', '0s');
        });

        $(".expand").click(function () {
            $("#main").toggleClass("fullscreen");
        });

        $("#videoSection").mouseup(function () {
            mouseState = 0;
            $('#videoSection').css('transition', '.3s');
        });

        $("#videoSection").mousemove(function (e) {
            if (mouseState === 1) {
                $('#videoSection').css('transition', '0s');
                var allTop = $('#main').offset().top;
                var top = videoPosition + (e.clientY - allTop - mousePosition);
                var vHeight = document.getElementById('videoSection').clientHeight;
                if (top > 0 && top < document.getElementsByClassName('chat-div')[0].clientHeight - vHeight) {
                    $("#videoSection").css("top", top);
                }
            }
        });
    }
});
