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
                if (isMounted) setStatus('error');
            }
        };

        const timer = setTimeout(init, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            cleanup();
        };
    }, [initKey, isActive]);

    const handleToggle = async () => {
        if (status === 'ready') {
            await cleanup();
            setStatus('stopped');
        } else {
            setInitKey(k => k + 1);
            setStatus('loading');
        }
    };

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '350px', position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 11 }}>
                <button 
                    onClick={handleToggle} 
                    style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: status === 'ready' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.7)', 
                        backdropFilter: 'blur(8px)',
                        border: 'none', 
                        borderRadius: '50%', 
                        color: 'white', 
                        fontSize: '24px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {status === 'ready' ? '🛑' : '📷'}
                </button>
            </div>
        </div>
    );
};

export default BarcodeScanner;
