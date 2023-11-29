
import { Camera } from '@mediapipe/camera_utils';
import { Category, FilesetResolver, GestureRecognizer, GestureRecognizerResult, Landmark } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Webcam from 'react-webcam';
import { AppConfig } from '../stores/configSlice';
import { RootState } from '../types/redux';

const Loading: React.FC = () => {
    return (
        <>
            <div className="fixed inset-0 bg-gray-200 bg-opacity-50 flex justify-center items-center">
                <div className="relative h-56 w-56">
                    <div className="absolute ease-linear rounded-full border-8 border-t-teal-500 h-56 w-56 animate-spin"></div>
                    <div className="absolute inset-0 flex justify-center items-center text-xl font-bold text-white">
                    </div>
                </div>
            </div>
        </>
    )
}

const GestureRecognition: React.FC = () => {

    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // ✨ 两个窗口的 redux 不是同一个实例，更新配置后需要重启摄像机
    const appConfigs: AppConfig[] = useSelector((state: RootState) => state.config.apps);

    // 模型加载状态
    const [isModelLoaded, setIsModelLoaded] = useState(false);

    // 左右手对应姿势
    const [detectedGestures, setDetectedGestures] = useState({ left: "", right: "" });
    const setGesture = (isLeftHand: boolean, text: string) => {
        setDetectedGestures(prev => ({
            ...prev,
            [isLeftHand ? 'left' : 'right']: text,
        }));
    };

    // 新旧食指指尖距离记录
    const lastFingerTipRef = useRef<{ x: number, y: number } | null>(null);

    // 核心步骤：读取模型 👋
    useEffect(() => {
        async function fetchData() {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "./models/gesture_recognizer.task",
                },
                runningMode: 'IMAGE',
                numHands: 2,
            });

            if (webcamRef.current) {
                const video = webcamRef.current.video!;
                const camera = new Camera(video, {
                    onFrame: async () => {
                        onResult(await gestureRecognizer.recognize(video));
                    }
                });

                camera.start();
            }
        }

        fetchData();
    }, []); // 指定当依赖依赖发生变化时才执行 useEffect 中的代码，如果是空数组则只会在组件挂载时执行一次，不会再次触发。

    // 调整 canvas 尺寸适配屏幕
    useEffect(() => {
        const resizeCanvas = () => {
            const video = webcamRef.current?.video;

            if (canvasRef.current && video && video.readyState >= 2) {
                const canvasElement = canvasRef.current;

                // 更新 canvas 的绘图缓冲区大小
                canvasElement.width = window.innerWidth;
                canvasElement.height = window.innerHeight;
            }
        };

        window.addEventListener('resize', resizeCanvas);

        const videoElement = webcamRef.current?.video;
        if (videoElement) {
            videoElement.addEventListener('loadedmetadata', resizeCanvas);
        }

        resizeCanvas(); // 在首次加载时调用

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (videoElement) {
                videoElement.removeEventListener('loadedmetadata', resizeCanvas);
            }
        };
    }, []);

    const currentProcessRef = useRef<string>("");
    useEffect(() => {
        window.controlApi.transmitProcess((processName: string) => {
            currentProcessRef.current = processName;
        });
    }, []);

    // 触发对应快捷键
    const lastTriggerRef = useRef({ shortcut: '', timestamp: 0 });
    useEffect(() => {
        const currentShortcut = findShortcut();
        const now = Date.now();
        // 防抖
        // todo 支持用户自定义延迟时间
        if (currentShortcut && (now - lastTriggerRef.current.timestamp > 1000 || lastTriggerRef.current.shortcut !== currentShortcut)) {
            window.controlApi.triggerShortcut(currentShortcut);
            lastTriggerRef.current = { shortcut: currentShortcut, timestamp: now };
        }


    }, [detectedGestures]);


    function onResult(result: GestureRecognizerResult) {
        // console.log(result);

        if (!isModelLoaded) {
            setIsModelLoaded(true);
        }

        if (webcamRef.current && webcamRef.current.video && canvasRef.current) {
            const canvasElement = canvasRef.current;
            const canvasCtx = canvasElement.getContext("2d");

            // 清除之前的绘制
            canvasCtx?.clearRect(0, 0, canvasElement.width, canvasElement.height);
            setDetectedGestures({ left: "", right: "" });

            // gestures[0] 左手；gestures[1]右手
            // gesture[0] -> 相当于 gestures[0][0] 和 gestures[0][1]，对应 Category 类型
            // 同理 landmarks[0][index] 和 landmarks[0][index] -> index 对应21个不同关节
            const { landmarks, handedness, gestures } = result;

            gestures.forEach((gesture, index) => {
                const isLeftHand = handedness[index] && handedness[index][0].categoryName === "Left";

                if (canvasCtx) {
                    drawHand(landmarks[index], canvasCtx, isLeftHand)
                };

                displayGesture(gesture[0], isLeftHand);

                // 单独处理指定手势
                if (gesture[0].categoryName == 'Pointing_Up') {
                    processCoordinates(landmarks[index], isLeftHand)
                }

            });
        };

    };

    function drawHand(handLandmarks: Landmark[], canvasCtx: CanvasRenderingContext2D, isLeftHand: boolean) {

        const fingerConnections = [
            [0, 1, 2, 3, 4], // 大拇指
            [0, 5, 6, 7, 8], // 食指
            [9, 10, 11, 12], // 中指
            [13, 14, 15, 16], // 无名指
            [0, 17, 18, 19, 20], // 小指
        ];

        // 定义左手和右手的不同样式
        const handColors = {
            left: {
                point: "#b4ea3e",
                line: "#54e856",
            },
            right: {
                point: "#57e6ff",
                line: "#06ffe2",
            },
        };

        canvasCtx.fillStyle = handColors[isLeftHand ? "left" : "right"].point;
        canvasCtx.strokeStyle = handColors[isLeftHand ? "left" : "right"].line;
        canvasCtx.lineWidth = 3;

        // 遍历手指连接关系并绘制点和线
        fingerConnections.forEach((finger) => {
            finger.forEach((pointIdx, idx, arr) => {
                const currentPoint = handLandmarks[pointIdx];
                const x = currentPoint.x * canvasCtx.canvas.width;
                const y = currentPoint.y * canvasCtx.canvas.height;

                // 绘制点
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 3, 0, 2 * Math.PI); // 使用 pointSize 作为半径
                canvasCtx.fill();

                // 绘制连接线
                if (idx < arr.length - 1) {
                    const nextPoint = handLandmarks[arr[idx + 1]];
                    const nextX = nextPoint.x * canvasCtx.canvas.width;
                    const nextY = nextPoint.y * canvasCtx.canvas.height;
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(x, y);
                    canvasCtx.lineTo(nextX, nextY);
                    canvasCtx.stroke();
                }
            });
        });

        // 单独处理以下点（形成手掌轮廓）
        const jointIndices = [5, 9, 13, 17];

        jointIndices.forEach((jointIdx, idx) => {
            const currentJoint = handLandmarks[jointIdx];
            const x = currentJoint.x * canvasCtx.canvas.width;
            const y = currentJoint.y * canvasCtx.canvas.height;

            // 绘制连接线
            if (idx < jointIndices.length - 1) {
                const nextJoint = handLandmarks[jointIndices[idx + 1]];
                const nextX = nextJoint.x * canvasCtx.canvas.width;
                const nextY = nextJoint.y * canvasCtx.canvas.height;
                canvasCtx.beginPath();
                canvasCtx.moveTo(x, y);
                canvasCtx.lineTo(nextX, nextY);
                canvasCtx.stroke();
            }
        });


    };

    function displayGesture(gesture: Category, isLeftHand: boolean) {
        // const { score, categoryName } = gesture;
        const { categoryName } = gesture;
        // const displayText = categoryName === 'None' ? "" : `${categoryName} (${(score * 100).toFixed(1)}%)`;
        const displayText = categoryName === 'None' ? "" : categoryName;
        setGesture(isLeftHand, displayText);
    };

    function findShortcut() {
        // 去除输出含有的换行符
        const currentProcess: string = currentProcessRef.current.replace(/\r\n$/, '');

        const findShortcutInConfig = (config: AppConfig) => {
            const shortcuts = config.shortcut;
            for (const shortcutName in shortcuts) {
                if (shortcuts.hasOwnProperty(shortcutName)) {
                    const shortcut = shortcuts[shortcutName];
                    if (shortcut[0] === detectedGestures.left && shortcut[1] === detectedGestures.right) {
                        return shortcutName;
                    }
                }
            }
            return null;
        };

        // 优先当前所在进程是否绑定了操作
        const currentConfig: AppConfig | undefined = appConfigs.find(appConfig => appConfig.name === currentProcess);
        if (currentConfig) {
            return findShortcutInConfig(currentConfig);
        }

        // 没有再在寻找全局设置里寻找
        const globalConfig: AppConfig | undefined = appConfigs.find(appConfig => appConfig.name === 'Global');
        if (globalConfig) {
            return findShortcutInConfig(globalConfig);
        }

        return null;
    }

    function processCoordinates(handLandmarks: Landmark[], isLeftHand: boolean) {
        // 向右 x 变小，向上 y 变小
        const fingerTip = {
            x: handLandmarks[8].x,
            y: handLandmarks[8].y,
        }

        if (lastFingerTipRef.current) {
            const deltaX = fingerTip.x - lastFingerTipRef.current.x;
            const deltaY = fingerTip.y - lastFingerTipRef.current.y;

            // 相减后差值大于正负 0.01 才考虑触发移动
            const debounceThreshold = 0.01;
            if (Math.abs(deltaX) > debounceThreshold || Math.abs(deltaY) > debounceThreshold) {
                // 放大倍数（在屏幕上移动的像素)，比如 0.02 相当于移动 20px
                const scaleFactor = 1000;

                let deltaCoordinates = { x: 0, y: 0 };
                // 选择移动幅度更大的方向（同时传xy，变为斜着移，不太准）
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    deltaCoordinates.x = -deltaX * scaleFactor;
                } else {
                    deltaCoordinates.y = deltaY * scaleFactor;
                }

                window.controlApi.triggerMouse(deltaCoordinates, isLeftHand);
            }
        }

        // 更新f以便下一次计算
        lastFingerTipRef.current = fingerTip;
    }

    return (
        <>
            {!isModelLoaded && <Loading />}

            {/* 相机部分 */}
            <div className="relative flex justify-center items-center h-screen w-screen">
                <Webcam ref={webcamRef}
                    className="absolute"
                    style={{
                        transform: "scaleX(-1)", // 前置摄像头镜像
                        width: '100%',
                        height: '100%',
                        objectFit: "fill" // 解决全屏填充的关键
                    }}
                />
                <canvas ref={canvasRef}
                    className="absolute"
                    style={{
                        transform: "scaleX(-1)",
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>


            {/* 输出的识别手势标签 */}
            <div className='absolute top-0 w-screen px-4 py-2 mt-8'>
                {detectedGestures.left && (
                    <div className="float-left bg-slate-500 text-white px-3 py-2 rounded-lg shadow-lg">
                        {detectedGestures.left}
                    </div>
                )}

                {detectedGestures.right && (
                    <div className="float-right bg-slate-500 text-white px-3 py-2 rounded-lg shadow-lg">
                        {detectedGestures.right}
                    </div>
                )}
            </div>
        </>
    );

}

export default GestureRecognition;