(function () {
    var animationQueue = new Array(); // 播放队列
    var context = new AudioContext();
    var audioCache = new Map(); // 音频缓存
    var isPlayingAudio = false;
    var lastClickTime = Date.now();

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

    function init() {
        var spineWidgetBase = document.getElementById("spine-widget-base");
        var spineWidget = document.createElement("div");
        spineWidget.id = "spine-widget";
        spineWidget.setAttribute("style", arknights_live2d_config.widgetStyle);
        spineWidgetBase.appendChild(spineWidget);

        downloadBinary(arknights_live2d_config.skeleton, function (data) {
            var skeletonBinary = new SkeletonBinary();
            skeletonBinary.data = data;
            skeletonBinary.initJson();

            new spine.SpineWidget("spine-widget", {
                animation: arknights_live2d_config.animations.start,
                skin: arknights_live2d_config.skin,
                atlas: arknights_live2d_config.atlas,
                jsonContent: skeletonBinary.json,
                backgroundColor: arknights_live2d_config.background,
                loop: false, // 默认不循环，因为要先放开始动画
                success: widgetLoadSuccess
            });
        }, function (status, responseText) {
            console.error(`Couldn't load binary ${path}: status ${status}, ${responseText}.`);
        });
    }

    function widgetLoadSuccess(widget) {
        widget.state.addListener({
            "complete": function (entry) {
                if (entry.animation.name == arknights_live2d_config.animations.start) {
                    playAudio(arknights_live2d_config.audios.start, false); // 只放一次，所以不缓存
                }
                if (animationQueue.length > 0) {
                    setAnimation(widget, animationQueue.shift(), false);
                } else {
                    checkIsIdle();

                    if (!entry.loop) {
                        setAnimation(widget, arknights_live2d_config.animations.idle, true);
                    }
                }
            }
        });

        widget.canvas.onclick = function () {
            if (animationQueue.length > 0) {
                console.warn("点击过于频繁！");
            } else {
                lastClickTime = Date.now();
                setAnimations(widget, arknights_live2d_config.animations.click);
                playAudio(arknights_live2d_config.audios.click, true);
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

    function playAudio(src, cacheable) {
        if (!src) {
            console.error("音频路径错误！");
            return;
        }
        if (isPlayingAudio) {
            console.warn("已经在播放音频！");
            return;
        }
        if (Array.isArray(src)) {
            src = src[randomRangeInt(src.length)];
        }

        isPlayingAudio = true;

        if (audioCache.has(src)) {
            playSource(audioCache.get(src));
        } else {
            downloadBinary(src, function (data) {
                context.decodeAudioData(data, function (buffer) {
                    var source = context.createBufferSource();
                    source.buffer = buffer;
                    source.loop = false;
                    source.connect(context.destination);
                    playSource(source);

                    if (cacheable) {
                        audioCache.set(src, source);
                    }
                }, function (e) {
                    console.error('Error decoding file', e);
                });
            }, function (status, responseText) {
                console.error(`Couldn't load binary ${path}: status ${status}, ${responseText}.`);
            });
        }

        function playSource(source) {
            source.start(0); //立即播放
            source.addEventListener("ended", function () {
                isPlayingAudio = false;
            });
        }
    }

    function checkIsIdle() {
        var time = Date.now();
        var delta = time - lastClickTime;
        var hour = Math.floor(delta / 1000 / 60 / 60);
        var minute = Math.floor(delta / 1000 / 60 - hour * 60);

        if (minute >= arknights_live2d_config.maxIdleMinute) {
            lastClickTime = time;
            playAudio(arknights_live2d_config.audios.idle, true);
        }
    }

    init();
})();