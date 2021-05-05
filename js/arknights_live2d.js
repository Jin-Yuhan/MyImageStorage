(function () {
    let spineWidgetBaseId = "spine-widget-base";
    let spineWidgetId = "spine-widget";
    let config = arknights_live2d_config;
    let animationQueue = new Array(); // 播放队列
    let audioPlayer = document.getElementById("spine-audio");
    let lastClickTime = Date.now();

    function downloadBinary(url, success, error) {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function () {
            if (request.status == 200) {
                success(new Uint8Array(request.response));
            } else {
                error(request.status, request.responseText);
            }
        };
        request.onerror = function () {
            error(request.status, request.responseText);
        };
        request.send();
    }

    function initSpineWidgetElement() {
        var spineWidget = document.createElement("div");
        spineWidget.id = spineWidgetId;
        spineWidget.setAttribute("style", config.widgetStyle);
        document.getElementById(spineWidgetBaseId).appendChild(spineWidget);
    }

    function widgetLoadSuccess(widget) {
        playAudio(config.audios.start);

        widget.state.addListener({
            "complete": function (entry) {
                if (animationQueue.length > 0) {
                    setAnimation(widget, animationQueue.shift(), false);
                } else {
                    checkIsIdle();

                    if (!entry.loop) {
                        setAnimation(widget, config.animations.idle, true);
                    }
                }
            }
        });

        widget.canvas.onclick = function () {
            if (animationQueue.length > 0) {
                console.warn("点击过于频繁！");
            } else {
                lastClickTime = Date.now();
                setAnimations(widget, config.animations.click);
                playAudio(config.audios.click);
            }
        }
    }

    function setAnimation(widget, anim, loop) {
        // widget.setAnimation 会先重置人物的姿势，动画会变得很奇怪
        widget.state.setAnimation(0, anim, loop);
    }

    function setAnimations(widget, anims) {
        setAnimation(widget, anims[0], false);
        animationQueue = animationQueue.concat(anims.slice(1)); // 加入播放队列
    }

    function randomRangeInt(maxExclusive) {
        return Math.floor(Math.random() * maxExclusive);
    }

    function playAudio(src) {
        if (!src) {
            console.error("音频路径错误！");
            return;
        }
        if (Array.isArray(src)) {
            src = src[randomRangeInt(src.length)];
        }
        if (src != audioPlayer.src) {
            audioPlayer.pause();
            audioPlayer.src = src;
            audioPlayer.loop = false;
            audioPlayer.play();
        }
    }

    function checkIsIdle() {
        var time = Date.now();
        var delta = time - lastClickTime;
        var hour = Math.floor(delta / 1000 / 60 / 60);
        var minute = Math.floor(delta / 1000 / 60 - hour * 60);

        if (minute >= config.maxIdleMinute) {
            lastClickTime = time;
            playAudio(config.audios.idle);
        }
    }

    (function init() {
        initSpineWidgetElement();

        downloadBinary(config.skeleton, function (data) {
            var skeletonJson = new spine.SkeletonJsonConverter(data, 1);
            skeletonJson.convertToJson();

            new spine.SpineWidget(spineWidgetId, {
                animation: config.animations.start,
                skin: config.skin,
                atlas: config.atlas,
                jsonContent: skeletonJson.json,
                backgroundColor: config.background,
                loop: false, // 默认不循环，因为要先放开始动画
                success: widgetLoadSuccess
            });
        }, function (status, responseText) {
            console.error(`Couldn't load binary ${path}: status ${status}, ${responseText}.`);
        });
    })();
})();