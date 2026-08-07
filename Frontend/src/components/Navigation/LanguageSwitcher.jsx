import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Icon } from '@gravity-ui/uikit';
import { Globe } from '@gravity-ui/icons';

const LANGUAGES = [
    { code: 'az', flag: '🇦🇿' },
    { code: 'en', flag: '🇬🇧' },
    { code: 'ru', flag: '🇷🇺' }
];

const LanguageSwitcher = () => {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

    const changeLanguage = (code) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                title="Language"
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '20px',
                    backgroundColor: '#21262d', border: '1px solid #30363d',
                    cursor: 'pointer', userSelect: 'none'
                }}
            >
                <Icon data={Globe} size={14} style={{ color: '#8b949e' }} />
                <Text variant="caption-2" style={{ color: '#c9d1d9' }}>{current.flag} {current.code.toUpperCase()}</Text>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '38px', right: 0, minWidth: '140px',
                    backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, overflow: 'hidden'
                }}>
                    {LANGUAGES.map((lang) => (
                        <div
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            style={{
                                padding: '10px 14px', cursor: 'pointer',
                                backgroundColor: lang.code === current.code ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <span>{lang.flag}</span>
                            <Text variant="body-2" style={{ color: '#f0f6fc' }}>{t(`lang.${lang.code}`)}</Text>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
