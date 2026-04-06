/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 */

import React from 'react';
import { WidgetConfigProvider } from '../WidgetConfig/WidgetContextProvider';
import StockProbeWidget from './StockProbeWidget';

const StockProbeWrapper: React.FC = () => (
    <WidgetConfigProvider widgetId="stockProbe">
        <StockProbeWidget />
    </WidgetConfigProvider>
);

export default StockProbeWrapper;
