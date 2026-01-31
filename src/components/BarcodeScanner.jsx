import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'stopped'
    const [initKey, setInitKey] = useState(0);

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const cleanup = async () => {
        if (scannerRef.current) {
            const s = scannerRef.current;
            scannerRef.current = null;
            try {
                await s.dispose();
            } catch (e) { }
        }
    };

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            if (!isActive) {
                setStatus('stopped');
                return;
            }

            try {
                const Dynamsoft = window.Dynamsoft;
                const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);
                
                const license = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9";
                BarcodeScannerClass.license = license;

                const config = {
                    container: containerRef.current,
                    license: license,
                    scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
                    barcodeFormats: [Dynamsoft.DBR?.EnumBarcodeFormat?.BF_CODE_128 || 0x400],
                    showPoweredByDynamsoft: false,
                    showResultView: false,
                    showUploadImageButton: false,
                    autoStartCapturing: true,
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                const scanner = new BarcodeScannerClass(config);
                scannerRef.current = scanner;
                await scanner.launch();
                
                if (isMounted) setStatus('ready');
            } catch (err) {
                console.error(err);
                if (isMounted) setStatus('error');
            }
        };

        const timer = setTimeout(init, 200);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            cleanup();
        };
    }, [initKey, isActive]);

    const handleStop = async () => {
        await cleanup();
        setStatus('stopped');
    };

    const handleRestart = () => {
        setInitKey(k => k + 1);
    };

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '350px', position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {status === 'stopped' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', color: 'white', zIndex: 12 }}>
                    <button onClick={handleRestart} style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Relancer
                    </button>
                </div>
            )}

            {status === 'ready' && (
                <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 11 }}>
                    <button onClick={handleStop} style={{ width: '50px', height: '50px', background: 'rgba(239, 68, 68, 0.4)', border: 'none', borderRadius: '50%', color: 'white', fontSize: '20px', cursor: 'pointer' }}>🛑</button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
