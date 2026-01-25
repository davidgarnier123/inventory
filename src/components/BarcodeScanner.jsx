import { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onScan, onError, isActive = true }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [currentCamera, setCurrentCamera] = useState(null);
    const [lastScanned, setLastScanned] = useState(null);

    const initScanner = useCallback(async () => {
        try {
            // Import Dynamsoft modules
            const { BarcodeReader, EnumBarcodeFormat } = await import('dynamsoft-barcode-reader-bundle');

            // Initialize with trial license (user can replace with their own)
            await BarcodeReader.initLicense('DLS2eyJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSJ9');

            // Get available cameras
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameras(videoDevices);

            // Prefer back camera
            const backCamera = videoDevices.find(d =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('arrière') ||
                d.label.toLowerCase().includes('rear')
            ) || videoDevices[0];

            if (backCamera) {
                setCurrentCamera(backCamera.deviceId);
            }

            // Create scanner instance
            const reader = await BarcodeReader.createInstance();

            // Configure for Code 128
            const settings = await reader.getRuntimeSettings();
            settings.barcodeFormatIds = EnumBarcodeFormat.BF_CODE_128;
            settings.expectedBarcodesCount = 1;
            settings.timeout = 500;
            await reader.updateRuntimeSettings(settings);

            scannerRef.current = reader;
            setIsReady(true);

        } catch (err) {
            console.error('Scanner init error:', err);
            onError?.(err.message || 'Erreur initialisation scanner');
        }
    }, [onError]);

    const startCamera = useCallback(async () => {
        if (!videoRef.current || !currentCamera) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: currentCamera },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'environment',
                    focusMode: 'continuous'
                }
            });

            videoRef.current.srcObject = stream;
            await videoRef.current.play();

        } catch (err) {
            console.error('Camera error:', err);
            onError?.('Erreur accès caméra: ' + err.message);
        }
    }, [currentCamera, onError]);

    const stopCamera = useCallback(() => {
        if (videoRef.current?.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }, []);

    const scanFrame = useCallback(async () => {
        if (!scannerRef.current || !videoRef.current || !canvasRef.current || !isActive) {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        try {
            const results = await scannerRef.current.decode(canvas);

            if (results && results.length > 0) {
                const code = results[0].barcodeText;

                // Debounce same code
                if (code !== lastScanned) {
                    setLastScanned(code);
                    onScan?.(code, results[0]);

                    // Play feedback sound
                    playBeep();

                    // Vibrate if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }

                    // Reset after 2 seconds
                    setTimeout(() => setLastScanned(null), 2000);
                }
            }
        } catch (err) {
            // Ignore decode errors (no barcode in frame)
        }
    }, [isActive, lastScanned, onScan]);

    const playBeep = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 1500;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            // Audio not supported
        }
    };

    const toggleTorch = async () => {
        if (!videoRef.current?.srcObject) return;

        const track = videoRef.current.srcObject.getVideoTracks()[0];
        if (!track) return;

        try {
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
                await track.applyConstraints({
                    advanced: [{ torch: !isTorchOn }]
                });
                setIsTorchOn(!isTorchOn);
            }
        } catch (err) {
            console.log('Torch not supported');
        }
    };

    const switchCamera = async () => {
        if (cameras.length < 2) return;

        const currentIndex = cameras.findIndex(c => c.deviceId === currentCamera);
        const nextIndex = (currentIndex + 1) % cameras.length;
        setCurrentCamera(cameras[nextIndex].deviceId);
    };

    useEffect(() => {
        initScanner();

        return () => {
            stopCamera();
            if (scannerRef.current) {
                scannerRef.current.destroyContext();
            }
        };
    }, []);

    useEffect(() => {
        if (isReady && currentCamera && isActive) {
            startCamera();
        } else {
            stopCamera();
        }
    }, [isReady, currentCamera, isActive, startCamera, stopCamera]);

    useEffect(() => {
        let animationId;

        const scan = () => {
            if (isActive && isReady) {
                scanFrame();
            }
            animationId = requestAnimationFrame(scan);
        };

        if (isActive && isReady) {
            animationId = requestAnimationFrame(scan);
        }

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [isActive, isReady, scanFrame]);

    return (
        <div className="barcode-scanner">
            <div className="scanner-viewport">
                <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="scanner-video"
                />
                <canvas ref={canvasRef} className="scanner-canvas" />

                <div className="scanner-overlay">
                    <div className="scan-region">
                        <div className="scan-corner top-left"></div>
                        <div className="scan-corner top-right"></div>
                        <div className="scan-corner bottom-left"></div>
                        <div className="scan-corner bottom-right"></div>
                        <div className="scan-line"></div>
                    </div>
                </div>

                {lastScanned && (
                    <div className="scan-result">
                        <span className="result-icon">✓</span>
                        <span className="result-code">{lastScanned}</span>
                    </div>
                )}
            </div>

            <div className="scanner-controls">
                <button
                    className={`control-btn ${isTorchOn ? 'active' : ''}`}
                    onClick={toggleTorch}
                    title="Lampe torche"
                >
                    🔦
                </button>

                {cameras.length > 1 && (
                    <button
                        className="control-btn"
                        onClick={switchCamera}
                        title="Changer de caméra"
                    >
                        🔄
                    </button>
                )}
            </div>

            {!isReady && (
                <div className="scanner-loading">
                    <div className="loading-spinner"></div>
                    <p>Initialisation du scanner...</p>
                </div>
            )}
        </div>
    );
}
