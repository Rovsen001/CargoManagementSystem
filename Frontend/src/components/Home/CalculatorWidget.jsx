// frontend/src/components/Home/CalculatorWidget.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, TextInput, Button, Select, Text, Alert } from '@gravity-ui/uikit';
import { Calculator } from '@gravity-ui/icons';

const CalculatorWidget = () => {
    const { t } = useTranslation();
    const [country, setCountry] = useState(['turkey']);
    const [weight, setWeight] = useState('');
    const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const calculatePrice = () => {
        setError('');
        const w = parseFloat(weight) || 0;
        const l = parseFloat(dimensions.length) || 0;
        const width = parseFloat(dimensions.width) || 0;
        const h = parseFloat(dimensions.height) || 0;

        if (w < 0 || l < 0 || width < 0 || h < 0) {
            setResult(null);
            setError(t('calculator.negativeError'));
            return;
        }

        if (w === 0) return;

        // Həcm çəkisi düsturu (En x Uzunluq x Hündürlük / 6000)
        const volumeWeight = (l * width * h) / 6000;
        const chargeableWeight = Math.max(w, volumeWeight);

        // Ölkəyə görə tarif (Türkiyə $4.5/kq, ABŞ $7.5/kq)
        const rate = country[0] === 'turkey' ? 4.5 : 7.5;
        const totalPrice = (chargeableWeight * rate).toFixed(2);

        setResult({
            weight: chargeableWeight.toFixed(2),
            price: totalPrice
        });
    };

    return (
        <Card
            view="outlined"
            style={{
                padding: '24px',
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderRadius: '16px'
            }}
        >
            <div style={{ marginBottom: '16px' }}>
                <Text variant="header-2" style={{ color: '#ffffff' }}>{t('calculator.title')}</Text>
                <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    {t('calculator.subtitle')}
                </Text>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>{t('calculator.country')}</Text>
                    <Select
                        size="l"
                        value={country}
                        onUpdate={setCountry}
                        width="max"
                    >
                        <Select.Option value="turkey">{t('calculator.turkey')}</Select.Option>
                        <Select.Option value="usa">{t('calculator.usa')}</Select.Option>
                    </Select>
                </div>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>{t('calculator.weight')}</Text>
                    <TextInput
                        size="l"
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={weight}
                        onUpdate={setWeight}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '2px', display: 'block' }}>{t('calculator.length')}</Text>
                    <TextInput
                        size="m"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={dimensions.length}
                        onUpdate={(val) => setDimensions({ ...dimensions, length: val })}
                    />
                </div>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '2px', display: 'block' }}>{t('calculator.width')}</Text>
                    <TextInput
                        size="m"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={dimensions.width}
                        onUpdate={(val) => setDimensions({ ...dimensions, width: val })}
                    />
                </div>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '2px', display: 'block' }}>{t('calculator.height')}</Text>
                    <TextInput
                        size="m"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={dimensions.height}
                        onUpdate={(val) => setDimensions({ ...dimensions, height: val })}
                    />
                </div>
            </div>

            <Button size="l" view="action" width="max" onClick={calculatePrice} disabled={!weight}>
                <Button.Icon><Calculator /></Button.Icon>
                {t('calculator.calculate')}
            </Button>

            {error && (
                <div style={{ marginTop: '16px' }}>
                    <Alert theme="danger" title={t('calculator.errorTitle')} message={error} />
                </div>
            )}

            {result && (
                <div style={{ marginTop: '16px' }}>
                    <Alert theme="success" title={t('calculator.resultTitle')} layout="horizontal">
                        <Text variant="body-2">
                            {t('calculator.calculatedWeight')}: <strong>{result.weight} kq</strong> | {t('calculator.amount')}: <strong>${result.price}</strong>
                        </Text>
                    </Alert>
                </div>
            )}
        </Card>
    );
};

export default CalculatorWidget;
