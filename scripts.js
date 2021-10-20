/*Copyright (C) 2021 Pierre Kreins  

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

const deltaT = 20;

const maxVolt = 120;
const maxAmp = 600;

var patchStatus = 0; //0 = reset , 1 = in bath, 2 = whole cell, 3 = recording passive ; 4 = recording voltage clampe ; 5 recording iv; 6 = passive recording done ; 7 voltage clamp recording done ; 8 = iv done
var bathTimer, wholeCellTimer, ivCurveTimer, voltageClampTimer, passiveTimer, lastDrawnPotX, lastDrawnPotY, lastDrawnCurX, lastDrawnCurY;
var bathTimerCounter = 0;
var lastPotential = 0;
var ivCurveCounter = 0;
var voltageClampCounter = 0;
var passiveCounter = 0;

var canvasPointsMatrix = new Array();

var ivDataMatrix = new Array(600); for (let i = 0; i < 600; ++i) ivDataMatrix[i] = [0, 0];

var ivMaxPointMatrix = new Array();

var ivFittedCurve = new Object();

MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']]
    },
    svg: {
        fontCache: 'global'
    }
};

$(function () {
    $("#waterBathButton").click(function () {

        if (patchStatus == 0) {
            patchStatus = 1;

            $('#waterBathButton').attr("disabled", 'disabled');
            $('#wholeCellButton').removeAttr("disabled");
            bathTimerCounter = 0;
            
            $("#simImg").fadeTo(300,0.30, function() {
                $("#simImg").attr("src",'ressources/in_bath_framed.svg');
            }).fadeTo(200,1,function() {
                bathTimer = setInterval(updateBathReadout, deltaT);
            });
            return false;
        }
    });

    $("#wholeCellButton").click(function () {

        if (patchStatus == 1) {
            patchStatus = 2;
            $("#compensate").attr("disabled", 'disabled');
            $('#wholeCellButton').attr("disabled", 'disabled');
            $('#startRecording').removeAttr("disabled");

            clearInterval(bathTimer);

            $("#simImg").fadeTo(300,0.30, function() {
                $("#simImg").attr("src",'ressources/in_oocyte_framed.svg');
            }).fadeTo(200,1,function() {
                wholeCellTimer = setInterval(updateWholeCellReadout, deltaT);
            });
            return false;

        
        }
    });

    $("#startRecording").click(function () {
        $('#startRecording').attr("disabled", 'disabled');
        if (patchStatus == 2) {

            $('#stopRecording').removeAttr("disabled");
            clearInterval(wholeCellTimer);
            canvasPointsMatrix.length = 0
            $('#V_mem').attr("readonly", 'readonly');
            $('#v_0Input').attr("readonly", 'readonly');
            $('#deltaVInput').attr("readonly", 'readonly');
            if ($('input[name=recordingMode]:checked').val() == '1') {
                //passive
                patchStatus = 3;
                passiveTimer = setInterval(recordPassive, deltaT);

            } else if ($('input[name=recordingMode]:checked').val() == '2') {
                //voltage
                patchStatus = 4;
                voltageClampTimer = setInterval(recordVoltagClamp, deltaT);

            } else {
                //ivcurve
                patchStatus = 5;
                ivCurveTimer = setInterval(recordIvCurve, deltaT);

            }
        } else if (patchStatus == 3) {
            $('#stopRecording').removeAttr("disabled");
            passiveTimer = setInterval(recordPassive, deltaT);
        } else if (patchStatus == 4) {
            $('#stopRecording').removeAttr("disabled");
            voltageClampTimer = setInterval(recordVoltagClamp, deltaT);
        } else if (patchStatus == 5) {
            $('#stopRecording').removeAttr("disabled");
            ivCurveTimer = setInterval(recordIvCurve, deltaT);
        }
    });
    $("#stopRecording").click(function () {
        clearInterval(ivCurveTimer);
        clearInterval(voltageClampTimer);
        clearInterval(passiveTimer);
        $('#stopRecording').attr("disabled", 'disabled');
        

        $('#startRecording').removeAttr("disabled");

    });

    $("#importIvData").click(function () {
        if (patchStatus == 8) {
            patchStatus = 9;
            $('#importIvData').attr("disabled", 'disabled');
            $('#analysisScreen').show();
            resizeCanvas();
            ivFittedCurve.status = 0;
            importIvData();
        }
    });

    $("#fitCurve").click(function () {
        if (patchStatus == 9) {
            $('#conductanceScreen').show();
            resizeCanvas();
            fitCurve();
        }
    });

    $("#compensate").click(function () {
        $('#offsetPotentialInput').val((-1 * getJunctionPotential()).toFixed(1));
    });

    $("#reboot").click(function () {
        clearInterval(bathTimer);
        clearInterval(ivCurveTimer);
        clearInterval(voltageClampTimer);
        clearInterval(passiveTimer);
        patchStatus = 0;
        bathTimerCounter = 0;
        lastPotential = 0;
        ivCurveCounter = 0;
        voltageClampCounter = 0;
        passiveCounter = 0;
        $('#startRecording').attr("disabled", 'disabled');
        $('#stopRecording').attr("disabled", 'disabled');
        $('#wholeCellButton').attr("disabled", 'disabled');
        $('#importIvData').attr("disabled", 'disabled');
        $('#fitCurve').attr("disabled", 'disabled');
        $('#waterBathButton').removeAttr("disabled");
        $('#compensate').removeAttr("disabled");
        $('#offsetPotentialInput').val('0');
        $('#potentialOutput').val('');
        $('#currentOutput').val('');
        $('#V_mem').removeAttr("readonly");
        $('#v_0Input').removeAttr("readonly");
        $('#deltaVInput').removeAttr("readonly");
        $('#V_mem').val('-80');
        $('#v_0Input').val('-90');
        $('#deltaVInput').val('15');
        $('#resultBody').html('');
        $('#resultHeader').hide();
        $('#resultBody').hide();
        $("#simImg").attr("src",'ressources/outside_framed.svg');
        canvasPointsMatrix = new Array();
        ivDataMatrix = new Array(600); for (let i = 0; i < 600; ++i) ivDataMatrix[i] = [0, 0];
        ivMaxPointMatrix = new Array();
        ivFittedCurve = new Object();

        resizeCanvas();
    });

    $('#selectedModel').change(function () {
        if ($('#selectedModel').val() == '1') {
            $('#modelDiv').html('$$I(U) = a \\cdot U + b$$');
        } else if ($('#selectedModel').val() == '2') {
            $('#modelDiv').html('$$I(U) = \\left(a \\cdot U + b\\right) \\cdot \\left( 1- \\frac{1}{ 1+ e^{\\frac{U-c}{d}} } \\right)$$');
        }
        MathJax.typeset();
    });



    resizeCanvas();

    $(window).on('resize', function () {
        resizeCanvas();
    });

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })

});

function importIvData() {
    var v_memForAnalysis = ivDataMatrix[0][0];
    var ivPointMatrix = new Array();


    for (let couple of ivDataMatrix) { //couple = [potential, current]
        var measuredPotential = couple[0];
        var measuredCurrent = couple[1];


        if (Math.abs(measuredPotential - v_memForAnalysis) <= 1) {

            continue;
        } else {

            let found = false;

            if (ivPointMatrix.length > 0) {
                for (let point of ivPointMatrix) {
                    if (Math.abs(measuredPotential - point.referencePotential) <= 1) {//has been recorded already
                        //add current
                        point.currents.push(measuredCurrent);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                let point = new Object();
                point.referencePotential = measuredPotential;
                point.currents = new Array(1);
                point.currents[0] = measuredCurrent;

                ivPointMatrix.push(point);
            }
        }
    }


    for (let potentialStepData of ivPointMatrix) {
        let point = new Object();
        point.referencePotential = potentialStepData.referencePotential;
        let i = potentialStepData.currents.indexOf(Math.max.apply(null, potentialStepData.currents.map(Math.abs)));


        if (i < 5) i = 5;
        point.averageCurrent = average(potentialStepData.currents.slice(i - 5, i + 5));
        ivMaxPointMatrix.push(point);
    }


    paintIvCanvas(ivMaxPointMatrix);

    $('#fitCurve').removeAttr('disabled');


}

function fitCurve() {

    var selectedModel = $('#selectedModel').val();

    var eq_obj;
    if (selectedModel == '1') {
        eq_obj = amd_cf.getEquation('line.jseo');
    } else if (selectedModel == '2') {
        eq_obj = amd_cf.getEquation('nastrommodell.jseo');
    }


    eq_obj.catch(function (err) {
        console.error('Something is wrong with the equation:', err);
    });

    var xValues = new Array();
    var yValues = new Array();
    for (let averagedPoint of ivMaxPointMatrix) {
        xValues.push([averagedPoint.referencePotential]);
        yValues.push(averagedPoint.averageCurrent);
    }

    var data1 = {
        x_values: xValues,
        y_values: yValues
    };

    eq_obj.fit(data1).then(function (res) {
        console.log('Done With 1', res);

        ivFittedCurve.parameters = res.parameters;
        if (selectedModel == '1') {
            ivFittedCurve.status = 1;
            $('#resultBody').html('$$a = ' + ivFittedCurve.parameters[0].toFixed(2) + ', b = ' + ivFittedCurve.parameters[1].toFixed(2) + '$$');
            MathJax.typeset();
            $('#resultHeader').show();
            $('#resultBody').show();

        } else if (selectedModel == '2') {
            ivFittedCurve.status = 2;
            $('#resultBody').html('$$a = ' + ivFittedCurve.parameters[0].toFixed(2) + ', b = ' + ivFittedCurve.parameters[1].toFixed(2) + ', c = ' + ivFittedCurve.parameters[2].toFixed(2) + ', d = ' + ivFittedCurve.parameters[3].toFixed(2) + '$$');
            MathJax.typeset();
            $('#resultHeader').show();
            $('#resultBody').show();
        }

        var fittedXValues = new Array();
        var fittedYValues = new Array();
        var fittedCondYValues = new Array();
        var xStart = -100;
        var xEnd = 100;
        for (let i = xStart; i <= xEnd; i += 0.1) {
            if (selectedModel == '1') {
                fittedYValues.push(lineModel(i, ivFittedCurve.parameters));
                fittedCondYValues.push(1);
            } else if (selectedModel == '2') {
                fittedYValues.push(naCurrentModel(i, ivFittedCurve.parameters));
                fittedCondYValues.push(conductanceModel(i, ivFittedCurve.parameters));
            }
            fittedXValues.push(i);
        }

        ivFittedCurve.xValues = fittedXValues;
        ivFittedCurve.yValues = fittedYValues;
        ivFittedCurve.condValues = fittedCondYValues;

        paintIvCanvas();


    }).catch(function (err) {
        console.error('1 did not work:', err);
    });






}

function paintIvCanvas() {

    var canvas = document.getElementById("analysisCanvas");
    var ctx = canvas.getContext("2d");
    var height = canvas.height;
    var width = canvas.width;

    ctx.strokeStyle = 'black';

    var middleX = Math.round(width / 2);
    var middleY = Math.round(height / 2);

    ctx.beginPath();

    ctx.lineWidth = '2.5';

    ctx.moveTo(getXValue(width, 0, 200), 0);
    ctx.lineTo(getXValue(width, 0, 200), height);
    ctx.moveTo(0, getYValue(height, 0, 1200));
    ctx.lineTo(width, getYValue(height, 0, 1200));

    ctx.stroke();

    let ampStep = 100;
    let voltStep = 10;

    ctx.setLineDash([3, 3]);

    ctx.strokeStyle = '#6b6b6b';
    ctx.lineWidth = '1';

    ctx.beginPath();

    ctx.font = "30px Arial";

    ctx.textBaseline = 'bottom';
    ctx.textAlign = "center";

    for (let i = 1; i < 11; i++) {
        ctx.moveTo(getXValue(width, i * voltStep, 200), 0);
        ctx.lineTo(getXValue(width, i * voltStep, 200), height - 15);
        let voltString = (i * voltStep).toString();

        ctx.fillText(voltString, getXValue(width, i * voltStep, 200), height);

        if (i == 10) {

            ctx.fillText('mV', getXValue(width, i * voltStep, 200), height - 12);
        }

        ctx.moveTo(getXValue(width, -1 * i * voltStep, 200), 0);
        ctx.lineTo(getXValue(width, -1 * i * voltStep, 200), height - 15);
        voltString = (-1 * i * voltStep).toString();
        ctx.fillText(voltString, getXValue(width, -1 * i * voltStep, 200), height);
    }

    ctx.strokeStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "left";

    for (let i = 1; i < 7; i++) {
        ctx.moveTo(0, getYValue(height, i * ampStep, 1200));
        ctx.lineTo(width, getYValue(height, i * ampStep, 1200));
        let ampString = (i * ampStep).toString();
        if (i == 6) { ampString += ' nA' }
        ctx.fillText(ampString, 0, getYValue(height, i * ampStep, 1200));

        ctx.moveTo(0, getYValue(height, -1 * i * ampStep, 1200));
        ctx.lineTo(width, getYValue(height, -1 * i * ampStep, 1200));
        ampString = (-1 * i * ampStep).toString();
        if (i != 6) {
            ctx.fillText(ampString, 0, getYValue(height, -1 * i * ampStep, 1200));
        }
    }

    ctx.stroke();

    //points
    for (let averagedPoint of ivMaxPointMatrix) {
        ctx.beginPath();

        ctx.arc(getXValue(width, averagedPoint.referencePotential, 200), getYValue(height, averagedPoint.averageCurrent, 1200), 8, 0, Math.PI * 2, false);
        ctx.fill();
    }
    //fitted curve
    if (ivFittedCurve.status != 0) {

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'green';
        ctx.lineWidth = '3';
        ctx.moveTo(getXValue(width, ivFittedCurve.xValues[0], 200), getYValue(height, ivFittedCurve.yValues[0], 1200));
        for (let i = 1; i < ivFittedCurve.xValues.length; i++) {
            ctx.lineTo(getXValue(width, ivFittedCurve.xValues[i], 200), getYValue(height, ivFittedCurve.yValues[i], 1200));
        }
        ctx.stroke();

        //conductance
        canvas = document.getElementById("conductanceCanvas");
        ctx = canvas.getContext("2d");
        height = canvas.height;
        width = canvas.width;

        ctx.strokeStyle = 'black';

        ctx.beginPath();
        ctx.lineWidth = '2.5';
        ctx.moveTo(0, getYValue(height, 0, 1.5, 1.2));
        ctx.lineTo(width - 30, getYValue(height, 0, 1.5, 1.2));
        ctx.moveTo(0, getYValue(height, 1, 1.5, 1.2));
        ctx.lineTo(width - 30, getYValue(height, 1, 1.5, 1.2));
        ctx.moveTo(getXValue(width, 0, 200), getYValue(height, 1.03, 1.5, 1.2));
        ctx.lineTo(getXValue(width, 0, 200), getYValue(height, -0.03, 1.5, 1.2));
        ctx.stroke();

        ctx.beginPath();

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#6b6b6b';
        ctx.lineWidth = '1';
        ctx.font = "30px Arial";
        ctx.textBaseline = 'top';
        ctx.textAlign = "center";

        ctx.moveTo(0, getYValue(height, 0.25, 1.5, 1.2));
        ctx.lineTo(width - 30, getYValue(height, 0.25, 1.5, 1.2));
        ctx.moveTo(0, getYValue(height, 0.5, 1.5, 1.2));
        ctx.lineTo(width - 30, getYValue(height, 0.5, 1.5, 1.2));
        ctx.moveTo(0, getYValue(height, 0.75, 1.5, 1.2));
        ctx.lineTo(width - 30, getYValue(height, 0.75, 1.5, 1.2));

        ctx.fillText('0', getXValue(width, 0, 200), getYValue(height, -0.03, 1.5, 1.2));

        for (let i = 1; i < 10; i++) {
            ctx.moveTo(getXValue(width, i * voltStep, 200), getYValue(height, 1.03, 1.5, 1.2));
            ctx.lineTo(getXValue(width, i * voltStep, 200), getYValue(height, -0.03, 1.5, 1.2));
            let voltString = (i * voltStep).toString();

            if (i == 9) {

                voltString += ' mV'
            }

            ctx.fillText(voltString, getXValue(width, i * voltStep, 200), getYValue(height, -0.03, 1.5, 1.2));



            ctx.moveTo(getXValue(width, -1 * i * voltStep, 200), getYValue(height, 1.03, 1.5, 1.2));
            ctx.lineTo(getXValue(width, -1 * i * voltStep, 200), getYValue(height, -0.03, 1.5, 1.2));
            voltString = (-1 * i * voltStep).toString();
            ctx.fillText(voltString, getXValue(width, -1 * i * voltStep, 200), getYValue(height, -0.03, 1.5, 1.2));
        }
        ctx.stroke();

        ctx.font = "bold 40px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = 'middle';
        ctx.fillText('0', width, getYValue(height, 0, 1.5, 1.2));
        ctx.fillText('0.25', width, getYValue(height, 0.25, 1.5, 1.2));
        ctx.fillText('0.5', width, getYValue(height, 0.5, 1.5, 1.2));
        ctx.fillText('0.75', width, getYValue(height, 0.75, 1.5, 1.2));
        ctx.fillText('1', width, getYValue(height, 1, 1.5, 1.2));

        ctx.beginPath();


        ctx.strokeStyle = 'blue';
        ctx.setLineDash([]);
        ctx.lineWidth = '5';
        ctx.moveTo(getXValue(width, ivFittedCurve.xValues[0], 200), getYValue(height, ivFittedCurve.condValues[0], 1.5, 1.2));
        for (let i = 1; i < ivFittedCurve.xValues.length; i++) {
            ctx.lineTo(getXValue(width, ivFittedCurve.xValues[i], 200), getYValue(height, ivFittedCurve.condValues[i], 1.5, 1.2));
        }
        ctx.stroke();
    }
}

function getXValue(width, x, amp, yShiftFactor = 2) {
    return Math.round((x / amp) * (width - 30) + Math.round((width - 30) / yShiftFactor) + 15);
}

function getYValue(height, y, amp, yShiftFactor = 2) {
    return Math.round(-1 * (y / amp) * (height - 30) + Math.round((height - 30) / yShiftFactor) + 15);
}

function recordPassive() {
    var time = timerCounterToTime(passiveCounter);

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");

    var naIn = 12;
    var kIn = 155;
    var caIn = 0.0001;
    var clIn = 4;

    var permeabilities = getPermeabilities(lastPotential, null);

    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];

    var rtfConstant = 25.6925775528;

    var membranePotential = rtfConstant * Math.log((pNa * naEx + pK * kEx + pCa * caEx + pCl * clIn) / (pNa * naIn + pK * kIn + pCa * caIn + pCl * clEx));


    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);
    var potential = juctionPotential + offsetPotential + noise + membranePotential;
    lastPotential = potential;


    var current = pNa * (potential - rtfConstant * Math.log(naEx / naIn)) + pK * (potential - rtfConstant * Math.log(kEx / kIn)) + pCa * (potential - rtfConstant * Math.log(caEx / caIn)) + pCl * (potential - rtfConstant * Math.log(clIn / clEx));  // totaler blödsinn muss aus G * (E-Em) berechnet werden
    $('#potentialOutput').val(potential.toFixed(1));
    $('#currentOutput').val(current.toFixed(0));


    if (voltageClampCounter == (60000 / deltaT)) {
        //stop
        clearInterval(passiveTimer);
        patchStatus = 6;
        $('#stopRecording').attr("disabled", 'disabled');
    } else {
        passiveCounter++;
        canvasPointsMatrix.push([time, potential, current]);
        paintMainCanvas();
    }
}

function recordVoltagClamp() {
    var time = timerCounterToTime(voltageClampCounter);

    var clampPotential = parseInt($('#V_mem').val());

    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);


    var potential = juctionPotential + offsetPotential + noise + clampPotential; //calculate actual membranepotential !!!!!!!

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");


    var naIn = 12;
    var kIn = 155;
    var caIn = 0.0001;
    var clIn = 4;


    var permeabilities = getPermeabilities(clampPotential, null);

    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];

    var rtfConstant = 25.6925775528;


    var current = pNa * (potential - rtfConstant * Math.log(naEx / naIn)) + pK * (potential - rtfConstant * Math.log(kEx / kIn)) + pCa * (potential - rtfConstant * Math.log(caEx / caIn)) + pCl * (potential - rtfConstant * Math.log(clIn / clEx));  // totaler blödsinn muss aus G * (E-Em) berechnet werden

    $('#potentialOutput').val(clampPotential.toFixed(1));
    $('#currentOutput').val(current.toFixed(0));



    if (voltageClampCounter == (60000 / deltaT)) {
        //stop
        clearInterval(voltageClampTimer);
        patchStatus = 7;
        $('#stopRecording').attr("disabled", 'disabled');
    } else {
        voltageClampCounter++;
        canvasPointsMatrix.push([time, clampPotential, current]);
        paintMainCanvas();
    }
}

function recordIvCurve() {
    var time = timerCounterToTime(ivCurveCounter);


    var [clampPotential, timeAtClampPotential] = getClampPotential(time);

    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);


    var potential = juctionPotential + offsetPotential + noise + clampPotential; //calculate actual membranepotential !!!!!!!

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");


    var naIn = 12;
    var kIn = 155;
    var caIn = 0.0001;
    var clIn = 4;


    var permeabilities = getPermeabilities(clampPotential, timeAtClampPotential);

    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];

    var rtfConstant = 25.6925775528;


    var current = pNa * (potential - rtfConstant * Math.log(naEx / naIn)) + pK * (potential - rtfConstant * Math.log(kEx / kIn)) + pCa * (potential - rtfConstant * Math.log(caEx / caIn)) + pCl * (potential - rtfConstant * Math.log(clIn / clEx));  // totaler blödsinn muss aus G * (E-Em) berechnet werden

    $('#potentialOutput').val(clampPotential.toFixed(1));
    $('#currentOutput').val(current.toFixed(0));

    ivDataMatrix[ivCurveCounter] = [clampPotential, current];

    if (ivCurveCounter == (60000 / deltaT)) {
        //stop
        clearInterval(ivCurveTimer);
        patchStatus = 8;
        $('#stopRecording').attr("disabled", 'disabled');
        $('#importIvData').removeAttr("disabled");

    } else {
        ivCurveCounter++;
        canvasPointsMatrix.push([time, clampPotential, current]);
        paintMainCanvas();
    }

}

function getClampPotential(time) {
    var V_mem = parseInt($('#V_mem').val());
    var pulseVoltageStart = parseInt($('#v_0Input').val());
    var pulseVoltageStep = parseInt($('#deltaVInput').val());
    var deltaTimeVmem = 3.21;
    var deltaTimePulse = 2.14;
    var deltaTimeBoth = deltaTimeVmem + deltaTimePulse;
    for (let i = 0; i < 11; i++) {
        if (time < (i * (deltaTimeBoth) + deltaTimeVmem)) {
            return [V_mem, null];
            break;
        } else if (time < ((i + 1) * (deltaTimeBoth))) {
            return [pulseVoltageStart + i * pulseVoltageStep, time - (i * (deltaTimeBoth) + deltaTimeVmem)];
            break;
        }
    }
    return [V_mem, null];

}

function updateWholeCellReadout() {

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");




    var time = timerCounterToTime(bathTimerCounter);

    var naIn = 12;
    var kIn = 155;
    var caIn = 0.0001;
    var clIn = 4;


    var permeabilities = getPermeabilities(lastPotential, null);

    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];

    var rtfConstant = 25.6925775528;

    var membranePotential = rtfConstant * Math.log((pNa * naEx + pK * kEx + pCa * caEx + pCl * clIn) / (pNa * naIn + pK * kIn + pCa * caIn + pCl * clEx));



    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);
    var potential = juctionPotential + offsetPotential + noise + membranePotential;
    lastPotential = potential;


    var current = pNa * (potential - rtfConstant * Math.log(naEx / naIn)) + pK * (potential - rtfConstant * Math.log(kEx / kIn)) + pCa * (potential - rtfConstant * Math.log(caEx / caIn)) + pCl * (potential - rtfConstant * Math.log(clIn / clEx));  // totaler blödsinn muss aus G * (E-Em) berechnet werden
    $('#potentialOutput').val(potential.toFixed(1));
    $('#currentOutput').val(current.toFixed(0));


    if (bathTimerCounter == (60000 / deltaT)) {
        bathTimerCounter = 0;
        canvasPointsMatrix.length = 0;

    } else {
        bathTimerCounter++;

        canvasPointsMatrix.push([time, potential, current]);

        paintMainCanvas();
    }

}

function getPermeabilities(potential, timeAtPotential) {
    var selectedChannel = $("#selectedChannel").val();


    switch (selectedChannel) {
        case '1':
            return [0, 4, 0, 0];
            break;
            case '1':
                return [0, 4, 0, 0];
                break;
        case '2'://kv
                var slope = 4;
                var vhalf = -25;
                var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
                var a = 0.86403262;
                var b = 0.05;
                var c = 0.01;
                var d = 10;
                if (timeAtPotential != null) {
                    var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                    conductance *= correction;
                }
    
                return [0, conductance, 0, 0];
                break;
        case '3': //kv ohne kinetik
            var slope = -4;
            var vhalf = -50;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));

            return [0, conductance, 0, 0];
            break;
        case '4'://kv
            var slope = -4;
            var vhalf = -50;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0.05;
            var c = 0.01;
            var d = 0.4;
            if (timeAtPotential != null) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }

            return [0, conductance, 0, 0];
            break;
        case '5'://Nav ohne kinetic
            var slope = -6;
            var vhalf = -45;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            

            return [conductance, 0, 0, 0];
            break;
        case '6'://Nav
            var slope = -6;
            var vhalf = -45;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0.06;
            var c = 0.01;
            var d = 0.04;
            if (timeAtPotential != null) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }

            return [conductance, 0, 0, 0];
            break;
        case '7'://Cav
            var slope = -6;
            var vhalf = -15;
            var conductance = 2 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0.05;
            var c = 0.01;
            var d = 0.6;
            if (timeAtPotential != null) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }

            return [0, 0, conductance, 0];
            break;
        case '8':
                return [0, 0, 0, 1];
                break;
    }


}

function getSelectedIon(ion) {


    var selectedIon = '#' + ion + $('input[name=selectedSolution]:checked').val();


    var concentration = parseInt($(selectedIon).val());
    return concentration;
}

function updateBathReadout() {
    var time = timerCounterToTime(bathTimerCounter);

    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);
    var potential = juctionPotential + offsetPotential + noise;
    lastPotential = potential;
    var pipetteResistance = 0.2; //megOhm
    var current = -1 * potential / pipetteResistance;
    $('#potentialOutput').val(potential.toFixed(1));
    $('#currentOutput').val(current.toFixed(0));

    if (bathTimerCounter == (60000 / deltaT)) {

        bathTimerCounter = 0;
        canvasPointsMatrix.length = 0;

    } else {
        bathTimerCounter++;

        canvasPointsMatrix.push([time, potential, current]);

        paintMainCanvas();
    }

}

function paintMainCanvas() {
    drawGrid();
    if (canvasPointsMatrix.length > 1) {
        
        var canvas = document.getElementById("mainCanvas");
        var ctx = canvas.getContext("2d");
        ctx.lineWidth = '6';
        ctx.setLineDash([]);
        var height = canvas.height;
        var width = canvas.width;

        var yStep = (height / 4);

        var time = canvasPointsMatrix[0][0];
        var potential = canvasPointsMatrix[0][1];

        var xPosition = Math.round((time / 60) * width);
        var yPosition = Math.round(3 * yStep - (potential / maxVolt) * (yStep - 20));
        ctx.beginPath();
        ctx.strokeStyle = 'red';
        ctx.setLineDash([]);
        ctx.moveTo(xPosition, yPosition);

        for (let i = 1; i < canvasPointsMatrix.length; i++) {



            time = canvasPointsMatrix[i][0];
            potential = canvasPointsMatrix[i][1];

            xPosition = Math.round((time / 60) * width);
            yPosition = Math.round(3 * yStep - (potential / maxVolt) * (yStep - 20));
            ctx.lineTo(xPosition, yPosition);

        }
        ctx.stroke();

        ctx.beginPath();

        ctx.strokeStyle = 'black';
        ctx.setLineDash([]);
        time = canvasPointsMatrix[0][0];
        var current = canvasPointsMatrix[0][2];

        xPosition = Math.round((time / 60) * width);
        yPosition = Math.round(yStep - (current / maxAmp) * (yStep - 20));
        ctx.moveTo(xPosition, yPosition);

        for (let i = 1; i < canvasPointsMatrix.length; i++) {

            time = canvasPointsMatrix[i][0];
            current = canvasPointsMatrix[i][2];

            xPosition = Math.round((time / 60) * width);
            yPosition = Math.round(yStep - (current / maxAmp) * (yStep - 20));
            ctx.lineTo(xPosition, yPosition);

        }
        ctx.stroke();

    }
}




function drawGrid() {
    var canvas = document.getElementById("mainCanvas");
    var ctx = canvas.getContext("2d");
    var height = canvas.height;
    var width = canvas.width;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "black";
    ctx.lineWidth = "3";
    ctx.setLineDash([]);



    ctx.beginPath();
    var yStep = Math.round(height / 4);
    var xStep = width / 60;

    ctx.moveTo(0, yStep);
    ctx.lineTo(width, yStep);
    ctx.moveTo(0, 3 * yStep);
    ctx.lineTo(width, 3 * yStep);
    var yUp = yStep - 6;
    var yDown = yStep + 6;
    for (let z = 1; z < 60; z++) {
        var x = Math.round(z * xStep);
        ctx.moveTo(x, yUp);
        ctx.lineTo(x, yDown);
    }
    yUp = 3 * yStep - 6;
    yDown = 3 * yStep + 6;
    for (let z = 1; z < 60; z++) {
        var x = Math.round(z * xStep);
        ctx.moveTo(x, yUp);
        ctx.lineTo(x, yDown);
    }
    ctx.stroke();

    ctx.beginPath();


    ctx.moveTo(xStep, 20);
    ctx.lineTo(xStep, 2 * yStep - 20);
    ctx.moveTo(xStep, 2 * yStep + 20);
    ctx.lineTo(xStep, 4 * yStep - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = "2";
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "#8f8f8f";

    var deltaY = (yStep - 30) / 6;
    var voltStep = Math.round(maxVolt / 6);
    var ampStep = Math.round(maxAmp / 6);

    ctx.font = "30px Arial";
    ctx.textBaseline = 'middle';
    ctx.textAlign = "left";

    for (let z = 1; z < 7; z++) {

        var y = Math.round(z * deltaY);
        var voltage = Math.round(z * voltStep).toString();
        var ampage = Math.round(z * ampStep).toString();
        if (z == 6) {
            voltage += ' mV';
            ampage += ' nA';
        }
        var negVoltage = Math.round(-1 * z * voltStep).toString();
        var negAmpage = Math.round(-1 * z * ampStep).toString();

        ctx.fillText(voltage, 80, 3 * yStep - y);
        ctx.fillText(negVoltage, 80, 3 * yStep + y);
        ctx.fillText(ampage, 80, yStep - y);
        ctx.fillText(negAmpage, 80, yStep + y);


        ctx.moveTo(0, yStep + y);
        ctx.lineTo(width, yStep + y);
        ctx.moveTo(0, yStep - y);
        ctx.lineTo(width, yStep - y);
        ctx.moveTo(0, 3 * yStep + y);
        ctx.lineTo(width, 3 * yStep + y);
        ctx.moveTo(0, 3 * yStep - y);
        ctx.lineTo(width, 3 * yStep - y);
    }

    ctx.stroke();

    ctx.font = "30px Arial";
    ctx.textBaseline = 'top';
    ctx.textAlign = "right";

    ctx.beginPath();
    ctx.fillText("60 s", width - 30, yStep + 15);
    ctx.fillText("60 s", width - 30, 3 * yStep + 15);
    ctx.stroke();


}

function getJunctionPotential() {

    return -1.8;
}

function getInternalConcentrations(){
    return [12 , 155, 0.0001, 4];
}

function getNoise(a) {
    return -a + Math.random() * 2 * a;
}

function average(nums) {
    return nums.reduce((a, b) => (a + b)) / nums.length;
}

function resizeCanvas() {
    var canvas = document.getElementById("mainCanvas");
    canvas.width = 3 * canvas.offsetWidth;
    canvas.height = 3 * canvas.offsetHeight;
    canvas = document.getElementById("analysisCanvas");
    canvas.width = 3 * canvas.offsetWidth;
    canvas.height = 3 * canvas.offsetHeight;
    canvas = document.getElementById("conductanceCanvas");
    canvas.width = 3 * canvas.offsetWidth;
    canvas.height = 3 * canvas.offsetHeight;
    if (typeof canvasPointsMatrix !== 'undefined') {
        paintMainCanvas();
    }
    if (typeof ivMaxPointMatrix !== 'undefined') {
        if (ivMaxPointMatrix.length > 0) {
            paintIvCanvas();
        }
    }

}

function timerCounterToTime(a) {
    return (a / (60000 / deltaT)) * 60;
}

function naCurrentModel(x, p) {
    return (p[0] * x + p[1]) * conductanceModel(x, p);
}

function conductanceModel(x, p) {
    return (1 - 1 / (1 + Math.exp((x - p[2]) / p[3])));
}

function lineModel(x, p) {
    return (p[0] * x + p[1]);
}