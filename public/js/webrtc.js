//глобальные
var call_to = null;
var call_from = null;
var mediaStream = null;
var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;

//звуки
var start_call_audio = new Audio();
start_call_audio.src = '/start_call.mp3';
start_call_audio.loop = true;

var calling_audio = new Audio();
calling_audio.src = '/calling.mp3';
calling_audio.loop = true;

var finish_call_audio = new Audio();
finish_call_audio.src = '/finish_call.mp3';

var pc = new PeerConnection({
    iceServers: [
        {urls: 'stun:stun.l.google.com:19302'},
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=tcp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
        }
    ]
}, {
    optional: [
        {DtlsSrtpKeyAgreement: true}, // требуется для соединения между Chrome и Firefox
        {RtpDataChannels: true} // требуется в Firefox для использования DataChannels API
    ]
});
pc.onicecandidate = gotIceCandidate;
pc.ontrack = gotRemoteStream;

//получаю дистанционный стрим
function gotRemoteStream(event) {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
}

//создаю предложение на звонок
function createOffer() {
    pc.createOffer(
        gotLocalDescription,
        function (error) {
            console.log(error)
        },
        {'mandatory': {'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true}}
    );
}

//создаю ответ на звонок
function createAnswer() {
    pc.createAnswer(
        gotLocalDescription,
        function (error) {
            console.log(error)
        },
        {'mandatory': {'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true}}
    );
}

//тупо скопировал
function gotLocalDescription(description) {
    pc.setLocalDescription(description);
    sendData(description);
}

//создаю себя как замороженого кандидата для стрима
function gotIceCandidate(event) {
    if (event.candidate) {
        sendData({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    }
}

//отправляю свой стрим
function sendData(data) {
    data.to = call_to;
    data.from = call_from;
    socket.emit('calling', data);
}

//начало звонка
function startCall(type, to, from) {
    call_to = to;
    call_from = from;

    $('.online-div i.call').addClass('disabled');
    $('.online-div #' + call_to + ' i.call').removeClass('disabled').addClass('active');
    if (type === 'answer') calling_audio.play();

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({audio: microphone, video: camera})
            .then(function (stream) {
                if (mediaStream === null) {
                    mediaStream = stream;

                    for (const track of stream.getTracks()) {
                        pc.addTrack(track, stream);
                    }

                    document.getElementById("localVideo").srcObject = stream;
                    $("#videoSection").removeClass("hidden");

                    socket.emit(type + ' call', {to: call_to, from: call_from});
                    if (type === 'offer') start_call_audio.play();
                    if (type === 'answer') calling_audio.pause();
                }
            })
            .catch(function (e) {
                console.log(e);
                microphone = false;
                camera = false;
                if (type === 'offer') {
                    call_to = null;
                    call_from = null;
                }
                finishCall();
            });
    }
}

//завершение звонка
function finishCall() {
    $('.online-div  i.call').removeClass('disabled').removeClass('active');

    document.getElementById("localVideo").srcObject = null;
    document.getElementById("remoteVideo").srcObject = null;
    $("#videoSection").addClass("hidden");

    if (call_to !== null && call_from !== null) {
        socket.emit('finish call', {to: call_to, from: call_from});
    }

    if (mediaStream !== null) {
        mediaStream.getTracks().forEach(function (track) {
            track.stop();
        });
        mediaStream = null;
    }

    finish_call_audio.play();
    calling_audio.pause();
    start_call_audio.pause();
    call_to = null;
    call_from = null;
}


$(function () {
    //ты завершаеш звонок
    $('#videoSection').on('click', '.end-call', function () {
        finishCall();
    });

    //ты звониш
    $('.online-div').on('click', '.call', function () {
        if (!$(this).hasClass('disabled')) {
            if (!$(this).hasClass('active')) {
                startCall('offer', $(this).parent().attr('id'), socket.id);
            } else {
                finishCall();
            }
        }
    });

    //к вам запрос на звонок
    socket.on('offer call', function (data) {
        startCall('answer', data.from, data.to);
    });

    //ответили на звонок
    socket.on('answer call', function (data) {
        start_call_audio.pause();
        createOffer();
    });

    //звонок
    socket.on('calling', function (data) {
        if (data.type === 'offer') {
            $("#videoSection").removeClass("hidden");
            pc.setRemoteDescription(new SessionDescription(data));
            createAnswer();
        } else if (data.type === 'answer') {
            $("#videoSection").removeClass("hidden");
            pc.setRemoteDescription(new SessionDescription(data));
        } else if (data.type === 'candidate') {
            var candidate = new IceCandidate({sdpMLineIndex: data.label, candidate: data.candidate});

            pc.addIceCandidate(candidate, function (data) {
                console.log('add candidate success');
            }, function (error) {
                console.log('add candidate error');
                console.log(error);
            });
        }
    });

    //он скинул звонок
    socket.on('finish call', function () {
        finishCall();
    });

    //при выходе пользователя
    socket.on('del user', function (id) {
        if (call_to === id || call_from === id) {
            finishCall();
        }
        $('.online-div #' + id).text('').remove();
    });
});
