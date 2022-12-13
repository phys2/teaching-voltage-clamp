/**
* @preserve Copyright (C) 2021 Pierre Kreins  
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>. 
*/

const deltaT = 20; //20

const dpi = window.devicePixelRatio;

const rtfConstant = 25.6925775528;

var maxVolt = 120;
var maxAmp = 600;

var voltOffset = 0;
var ampOffset = 0;

var ivMaxAmp = 600;
var ivY0RelPos = 0.5;
var ivX0RelPos = 0.5;

var patchStatus = 0; //0 = reset , 1 = in bath, 2 = whole cell, 3 = recording passive ; 4 = recording voltage clampe ; 5 recording iv; 6 = passive recording done ; 7 voltage clamp recording done ; 8 = iv done
var bathTimer, wholeCellTimer, ivCurveTimer, voltageClampTimer, passiveTimer, lastDrawnPotX, lastDrawnPotY, lastDrawnCurX, lastDrawnCurY;
var bathTimerCounter = 0;
var lastPotential = 0;
var ivCurveCounter = 0;
var voltageClampCounter = 0;
var passiveCounter = 0;

var canvasPointsMatrix = new Array();

var ivDataMatrix = new Array(600); for (let i = 0; i < 600; ++i) ivDataMatrix[i] = [0, 0];

var ivMaxPointTotalMatrix = new Array();

var ivFittedCurve = new Object();

var junctionPotentials = new Array();

var updateOutputFieldsCounter = 0;

var isDragging = false;


$(function () {

    $("#waterBathButton").click(function () {

        if (patchStatus == 0) {
            patchStatus = 1;

            $('#waterBathButton').attr("disabled", 'disabled');
            $('#wholeCellButton').removeAttr("disabled");
            bathTimerCounter = 0;

            $("#simImg").fadeTo(300, 0.30, function () {
                $("#simImg").attr("src", 'ressources/in_bath_framed.svg');
            }).fadeTo(200, 1, function () {
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
            $('#selectedChannel').attr("disabled", 'disabled');
            $('#startRecording').removeAttr("disabled");

            clearInterval(bathTimer);

            $("#simImg").fadeTo(300, 0.30, function () {
                $("#simImg").attr("src", 'ressources/in_oocyte_framed.svg');
            }).fadeTo(200, 1, function () {
                wholeCellTimer = setInterval(updateWholeCellReadout, deltaT);
            });
            return false;


        }
    });

    $("#startRecording").click(function () {
        $('#startRecording').attr("disabled", 'disabled');
        if (patchStatus == 2) {
            $('input[name=recordingMode]').attr("disabled", 'disabled');
            $('#stopRecording').removeAttr("disabled");
            clearInterval(wholeCellTimer);
            canvasPointsMatrix.length = 0

            if ($('input[name=recordingMode]:checked').val() == '1') {
                //passive
                patchStatus = 3;
                passiveTimer = setInterval(recordPassive, deltaT);
                $('#V_mem').attr("readonly", 'readonly');
                $('#v_0Input').attr("readonly", 'readonly');
                $('#deltaVInput').attr("readonly", 'readonly');
            } else if ($('input[name=recordingMode]:checked').val() == '2') {
                //voltage
                patchStatus = 4;
                voltageClampTimer = setInterval(recordVoltagClamp, deltaT);

            } else {
                //ivcurve
                patchStatus = 5;
                ivCurveTimer = setInterval(recordIvCurve, deltaT);                
                $('#V_mem').attr("readonly", 'readonly');
                $('#v_0Input').attr("readonly", 'readonly');
                $('#deltaVInput').attr("readonly", 'readonly');
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
        clearInterval(wholeCellTimer);
        clearInterval(ivCurveTimer);
        clearInterval(voltageClampTimer);
        clearInterval(passiveTimer);
        patchStatus = 0;
        bathTimerCounter = 0;
        lastPotential = 0;
        ivCurveCounter = 0;
        voltageClampCounter = 0;
        passiveCounter = 0;
        $('input[name=recordingMode]').removeAttr("disabled");
        $('#startRecording').attr("disabled", 'disabled');
        $('#stopRecording').attr("disabled", 'disabled');
        $('#wholeCellButton').attr("disabled", 'disabled');
        $('#importIvData').attr("disabled", 'disabled');
        $('#waterBathButton').removeAttr("disabled");
        $('#compensate').removeAttr("disabled");
        $('#selectedChannel').removeAttr("disabled");
        $('#offsetPotentialInput').val('0');
        $('#potentialOutput').val('');
        $('#currentOutput').val('');
        $('#V_mem').removeAttr("readonly");
        $('#v_0Input').removeAttr("readonly");
        $('#deltaVInput').removeAttr("readonly");
        $('#V_mem').val('-80');
        $('#v_0Input').val('-90');
        $('#deltaVInput').val('15');
        $('#Na1').val('150');
        $('#K1').val('5');
        $('#Ca1').val('1');
        $('#Cl1').val('120');
        $('#Na2').val('150');
        $('#K2').val('20');
        $('#Ca2').val('1');
        $('#Cl2').val('120');
        $("#simImg").attr("src", 'ressources/outside_framed.svg');
        junctionPotentials = new Array();
        updateOutputFieldsCounter = 0;
        maxAmp = 600;
        ivMaxAmp = 600;
        maxVolt = 120;
        voltOffset = 0;
        ampOffset = 0;
        canvasPointsMatrix = new Array();
        ivDataMatrix = new Array(600); for (let i = 0; i < 600; ++i) ivDataMatrix[i] = [0, 0];
        resizeCanvas();
    });

    document.getElementById('selectedModel').addEventListener("change", function () {
        MathJax.typesetClear();
        if (document.getElementById('selectedModel').value == '1') {
            document.getElementById('modelDiv').innerHTML = '<p> $$I(U) = a \\cdot U + b$$ </p>';
        } else if (document.getElementById('selectedModel').value == '2') {
            document.getElementById('modelDiv').innerHTML = '<p> $$I(U) = \\left(a \\cdot U + b\\right) \\cdot \\left( 1- \\frac{1}{ 1+ e^{\\frac{U-c}{d}} } \\right)$$ </p>';
        }
        $('#resultHeader').hide();
        $('#resultBody').hide();
        MathJax.typeset([document.getElementById('modelDiv')]);
    });

    $('#ampZoomIn').click(function () {
        maxAmp = maxAmp / 2;
        paintMainCanvas();
    });
    $('#ampZoomOut').click(function () {
        maxAmp = maxAmp * 2;
        paintMainCanvas();
    });
    $('#voltZoomIn').click(function () {
        maxVolt = maxVolt / 2;
        paintMainCanvas();
    });
    $('#voltZoomOut').click(function () {
        maxVolt = maxVolt * 2;
        paintMainCanvas();
    });
    $('#ampOffsetUp').click(function () {
        ampOffset = ampOffset - 1;
        paintMainCanvas();
    });
    $('#ampOffsetDown').click(function () {
        ampOffset = ampOffset + 1;
        paintMainCanvas();
    });
    $('#voltOffsetUp').click(function () {
        voltOffset = voltOffset - 1;
        paintMainCanvas();
    });
    $('#voltOffsetDown').click(function () {
        voltOffset = voltOffset + 1;
        paintMainCanvas();
    });
    $('#ampZoomIvIn').click(function () {
        ivMaxAmp = Math.round(ivMaxAmp / 2);
        paintIvCanvas();
    });
    $('#ampZoomIvOut').click(function () {
        ivMaxAmp = Math.round(ivMaxAmp * 2);
        paintIvCanvas();
    });

    $('#openModeButton').click(function () {
        loadOpenMode();
        $('input:radio[name="displayModeRadio"]').filter('[value="open"]').attr('checked', true);
    });
    $('#hiddenModeButton').click(function () {
        loadHiddenMode();
        $('input:radio[name="displayModeRadio"]').filter('[value="hidden"]').attr('checked', true);
    });

    $('input[type=radio][name=displayModeRadio]').change(function () {
        if (this.value == 'open') {
            loadOpenMode();
        }
        else {
            loadHiddenMode();
        }
    });

    $('#toggleAmpage').click(function () {
        $('#ampageCanvas').toggle(600);
        $('.ampagePositionControlDiv').toggle(600);
        $('#toggleAmpageExpandText').toggle(600, "linear");
        $('#ampageScreen').toggleClass('hiddenScreen');
        $('#toggleAmpageIcon').toggleClass('bi-arrows-collapse');
        $('#toggleAmpageIcon').toggleClass('bi-arrows-expand');
    });

    $('#toggleVoltage').click(function () {
        $('#voltageCanvas').toggle(600);
        $('.voltagePositionControlDiv').toggle(600);
        $('#toggleVoltageExpandText').toggle(600, "linear");
        $('#voltageScreen').toggleClass('hiddenScreen');
        $('#toggleVoltageIcon').toggleClass('bi-arrows-collapse');
        $('#toggleVoltageIcon').toggleClass('bi-arrows-expand');
    });

    $('#eraseIvButton').click(function () {
        $('#eraseIvButton').attr("disabled", 'disabled');
        $('#selectedChannelToFit').attr("disabled", 'disabled');
        $('#fitCurve').attr("disabled", 'disabled');
        ivMaxPointTotalMatrix = new Array(); 
        $("#channelLegend").empty(); 
        $("#selectedChannelToFit").empty(); 
        $('#selectedChannelToFit').append($('<option>', {
            value: 'NaN',
            text: 'Kanal ausw\u00e4hlen...'
        }));
        $('#analysisScreen').hide();
        $('#conductanceScreen').hide();
        $('#resultBody').html('');
        $('#resultHeader').hide();
        $('#resultBody').hide();
        paintIvCanvas();
    });

    ///BEGIN Drag over IV Canvas functions

    function handleMouseDown(e) {

        // set the drag flag
        isDragging = true;
    }

    function handleMouseUp(e) {

        // clear the drag flag
        isDragging = false;
    }

    function handleMouseOut(e) {
        // user has left the canvas, so clear the drag flag
        isDragging = false;
    }
    function handleMouseMove(e) {
        // if the drag flag is set, clear the canvas and draw the image
        if (isDragging) {
            var dX = e.movementX;
            var dY = e.movementY;
            var canvas = document.getElementById("analysisCanvas");
            var height = canvas.offsetHeight;
            var width = canvas.offsetWidth;
            ivY0RelPos = ivY0RelPos + dY / height;
            ivX0RelPos = ivX0RelPos + dX / width;
            paintIvCanvas();
        }
    }

    document.getElementById('analysisCanvas').addEventListener('mousedown', handleMouseDown);
    document.getElementById('analysisCanvas').addEventListener('mousemove', handleMouseMove);
    document.getElementById('analysisCanvas').addEventListener('mouseup', handleMouseUp);
    document.getElementById('analysisCanvas').addEventListener('mouseout', handleMouseOut);

    ///END Drag over IV Canvas functions

    var bathCollapsible = document.getElementById('collapseBath');
    var controlsCollapsible = document.getElementById('collapseControls');
    var bathCaret = document.getElementById('bathCaret');
    var controlsCaret = document.getElementById('controlsCaret');
    bathCollapsible.addEventListener('hidden.bs.collapse', function () {
        bathCaret.classList.replace('bi-caret-up-fill', 'bi-caret-down-fill');
    });
    bathCollapsible.addEventListener('shown.bs.collapse', function () {
        bathCaret.classList.replace('bi-caret-down-fill', 'bi-caret-up-fill');
    });
    controlsCollapsible.addEventListener('hidden.bs.collapse', function () {
        controlsCaret.classList.replace('bi-caret-up-fill', 'bi-caret-down-fill');
    });
    controlsCollapsible.addEventListener('shown.bs.collapse', function () {
        controlsCaret.classList.replace('bi-caret-down-fill', 'bi-caret-up-fill');
    });

    var ro = new ResizeObserver(entries => {
        resizeCanvas();
    });

    ro.observe(document.getElementById('ampageCanvas'));
    ro.observe(document.getElementById('voltageCanvas'));

    resizeCanvas();

    $(window).on('resize', function () {
        resizeCanvas();
    });

    $(window).on('pageshow', function () {
        var myModal = new bootstrap.Modal(document.getElementById('choiceModal'), {
            keyboard: false
        });
        myModal.show();
    });



    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })

});

function loadOpenMode() {
    $('#selectedChannel').html('<option value="1" selected>daueroffen f&uuml;r K&#x207A;</option><option value="2">K&#x1D62;&#x1D63;</option><option value="3">K&#x1D65; (nicht inaktivierend)</option><option value="4">Na&#x1D65; (nicht inaktivierend)</option><option value="5">daueroffen f&uuml;r Na&#x207A;</option><option value="6">daueroffen f&uuml;r Cl&#x207B;</option><option value="7">Ca&#x1D65;</option><option value="8"> K&#x1D65; (inaktivierend)</option><option value="9">Na&#x1D65; (inaktivierend)</option><option value="10">nicht-selektiver Kationenkanal</option>');
}
function loadHiddenMode() {
    $('#selectedChannel').html('<option value="1" selected>unbekannter Kanal 1</option><option value="2">unbekannter Kanal 2</option><option value="3">unbekannter Kanal 3</option><option value="4">unbekannter Kanal 4</option><option value="5">unbekannter Kanal 5</option><option value="6">unbekannter Kanal 6</option><option value="7">unbekannter Kanal 7</option><option value="8">unbekannter Kanal 8</option><option value="9">unbekannter Kanal 9</option><option value="10">unbekannter Kanal 10</option>');
}

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

    var ivMaxPointChannelMatrix = new Object();
    channelName =$("#selectedChannel option:selected").text();
    var occ = numberOfNameOccurences(channelName);
    ivMaxPointChannelMatrix.channelName = channelName;
    if (occ > 0) {
        occ++;
        ivMaxPointChannelMatrix.channelIndex = occ;
        channelName += ' (' + ivMaxPointChannelMatrix.channelIndex.toString() + ')';        
    }
    
    ivMaxPointChannelMatrix.display = true;
    ivMaxPointChannelMatrix.values = new Array();

    for (let potentialStepData of ivPointMatrix) {
        let point = new Object();
        point.referencePotential = potentialStepData.referencePotential;
        let i = potentialStepData.currents.indexOf(Math.max.apply(null, potentialStepData.currents.map(Math.abs)));
        if (i < 5) i = 5;
        point.averageCurrent = average(potentialStepData.currents.slice(i - 5, i + 5));
        ivMaxPointChannelMatrix.values.push(point);
    }

    ivMaxPointTotalMatrix.push(ivMaxPointChannelMatrix);


    paintIvCanvas();

    $('#fitCurve').removeAttr('disabled');
    $('#eraseIvButton').removeAttr('disabled');

    
        $('#selectedChannelToFit').append($('<option>', {
        value: ivMaxPointTotalMatrix.length-1,
        text: channelName
    }));
    if ($('#selectedChannelToFit').val() == 'NaN'){
        $('#selectedChannelToFit').children('option[value="NaN"]').remove();
        $('#selectedChannelToFit').removeAttr('disabled'); 
    }
    

}

function fitCurve() {
    document.getElementById('loadingSpinner').style.display = 'inline-block';
    var selectedModel = $('#selectedModel').val();

    var selectedChannelToFit = $('#selectedChannelToFit').val();

    var eq_obj;
    if (selectedModel == '1') {
        eq_obj = amd_cf.getEquation('js/line.jseo');
    } else if (selectedModel == '2') {
        eq_obj = amd_cf.getEquation('js/nastrommodell.jseo');
    }


    eq_obj.catch(function (err) {
        console.error('Something is wrong with the equation:', err);
    });

    var xValues = new Array();
    var yValues = new Array();
    for (let averagedPoint of ivMaxPointTotalMatrix[selectedChannelToFit].values) {
        xValues.push([averagedPoint.referencePotential]);
        yValues.push(averagedPoint.averageCurrent);
    }

    var data1 = {
        x_values: xValues,
        y_values: yValues
    };

    eq_obj.fit(data1).then(function (res) {
        console.log('Done With 1', res);

        ivMaxPointTotalMatrix[selectedChannelToFit].parameters = res.parameters;

        if (selectedModel == '1') {

            ivMaxPointTotalMatrix[selectedChannelToFit].fitStatus = 1;
            $('#resultBody').empty().append("<p>" + '$$a = ' + res.parameters[0].toFixed(2) + ', b = ' + res.parameters[1].toFixed(2) + '$$' + "</p>");


        } else if (selectedModel == '2') {

            ivMaxPointTotalMatrix[selectedChannelToFit].fitStatus = 2;
            $('#resultBody').empty().append("<p>" + '$$a = ' + res.parameters[0].toFixed(2) + ', b = ' + res.parameters[1].toFixed(2) + ', c = ' + res.parameters[2].toFixed(2) + ', d = ' + res.parameters[3].toFixed(2) + '$$' + "</p>");

        }

        $('#resultHeader').show();
        $('#resultBody').show();
        MathJax.typesetClear();
        MathJax.typeset([document.getElementById('resultBody')]);

        var fittedXValues = new Array();
        var fittedYValues = new Array();
        var fittedCondYValues = new Array();
        var xStart = -200;
        var xEnd = 200;
        for (let i = xStart; i <= xEnd; i += 0.1) {
            if (selectedModel == '1') {
                fittedYValues.push(lineModel(i, res.parameters));
                fittedCondYValues.push(1);
            } else if (selectedModel == '2') {
                fittedYValues.push(naCurrentModel(i, res.parameters));
                fittedCondYValues.push(conductanceModel(i, res.parameters));
            }
            fittedXValues.push(i);
        }

        ivMaxPointTotalMatrix[selectedChannelToFit].fittedXValues = fittedXValues;
        ivMaxPointTotalMatrix[selectedChannelToFit].fittedYValues = fittedYValues;
        ivMaxPointTotalMatrix[selectedChannelToFit].fittedCondYValues = fittedCondYValues;

        paintIvCanvas();
        document.getElementById('loadingSpinner').style.display = 'none';


    }).catch(function (err) {
        console.error('1 did not work:', err);
    });

}

function paintIvCanvas() {

    var canvas = document.getElementById("analysisCanvas");
    var ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpi, dpi);
    var height = canvas.getBoundingClientRect().height;
    var width = canvas.getBoundingClientRect().width;


    //conct Canvas
    var condCanvas = document.getElementById("conductanceCanvas");
    var condCtx = condCanvas.getContext("2d");
    condCtx.setTransform(1, 0, 0, 1, 0, 0);
    condCtx.scale(dpi, dpi);
    condHeight = condCanvas.getBoundingClientRect().height;
    condWidth = condCanvas.getBoundingClientRect().width;
    //conc Canvas end


    ctx.fillStyle = "white";

    ctx.fillRect(0, 0, width, height);



    var middleX = Math.round(width / 2);
    var middleY = Math.round(height / 2);

    ctx.beginPath();

    ctx.lineWidth = '1.5';
    ctx.strokeStyle = 'black';
    ctx.setLineDash([]);

    ctx.moveTo(getIvXValue(width, 0, 200, ivX0RelPos), 0);
    ctx.lineTo(getIvXValue(width, 0, 200, ivX0RelPos), height);
    ctx.moveTo(0, getIvYValue(height, 0, 2 * ivMaxAmp, ivY0RelPos));
    ctx.lineTo(width, getIvYValue(height, 0, 2 * ivMaxAmp, ivY0RelPos));

    ctx.stroke();

    let ampStep = Math.round(ivMaxAmp / 6);
    let voltStep = 10;

    ctx.setLineDash([2, 2]);

    ctx.strokeStyle = '#6b6b6b';
    ctx.lineWidth = '1';

    ctx.beginPath();

    ctx.font = "11px Arial";
    ctx.fillStyle = "black";
    ctx.textBaseline = 'bottom';
    ctx.textAlign = "center";

    for (let i = 1; i < 21; i++) {
        ctx.moveTo(getIvXValue(width, i * voltStep, 200, ivX0RelPos), 0);
        ctx.lineTo(getIvXValue(width, i * voltStep, 200, ivX0RelPos), height - 15);
        let voltString = (i * voltStep).toString();

        ctx.fillText(voltString, getIvXValue(width, i * voltStep, 200, ivX0RelPos), height);

        if (i % 10 == 0) {

            ctx.fillText('mV', getIvXValue(width, i * voltStep, 200, ivX0RelPos), height - 12);
        }

        ctx.moveTo(getIvXValue(width, -1 * i * voltStep, 200, ivX0RelPos), 0);
        ctx.lineTo(getIvXValue(width, -1 * i * voltStep, 200, ivX0RelPos), height - 15);
        voltString = (-1 * i * voltStep).toString();
        ctx.fillText(voltString, getIvXValue(width, -1 * i * voltStep, 200, ivX0RelPos), height);
    }

    ctx.strokeStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "left";

    for (let i = 1; i < 20; i++) {
        ctx.moveTo(0, getIvYValue(height, i * ampStep, 2 * ivMaxAmp, ivY0RelPos));
        ctx.lineTo(width, getIvYValue(height, i * ampStep, 2 * ivMaxAmp, ivY0RelPos));
        let ampString = (i * ampStep).toString();
        if (i % 6 == 0) { ampString += ' nA' }
        ctx.fillText(ampString, 0, getIvYValue(height, i * ampStep, 2 * ivMaxAmp, ivY0RelPos));

        ctx.moveTo(0, getIvYValue(height, -1 * i * ampStep, 2 * ivMaxAmp, ivY0RelPos));
        ctx.lineTo(width, getIvYValue(height, -1 * i * ampStep, 2 * ivMaxAmp, ivY0RelPos));
        ampString = (-1 * i * ampStep).toString();

        ctx.fillText(ampString, 0, getIvYValue(height, -1 * i * ampStep, 2 * ivMaxAmp, ivY0RelPos));

    }

    ctx.stroke();


    //conductance grid
    drawConductanceGrid();

    //points
    document.getElementById('channelLegend').innerHTML = '';
    var channelColorArray = ['--bs-green', '--bs-blue', '--bs-red', '--bs-yellow', '--bs-purple', '--bs-orange', '--bs-cyan', '--bs-pink', '--bs-teal'];


    for (let i = 0; i < ivMaxPointTotalMatrix.length; i++) {
        ivMaxPointChannelMatrix = ivMaxPointTotalMatrix[i];
        var element = document.createElement('div');
        element.classList.add("btn");
        element.classList.add("btn-sm");
        element.classList.add("mb-2");
        element.classList.add("me-2");
        element.style.setProperty('--channelColor', 'var(' + channelColorArray[i] + ')');
        var isShown = ivMaxPointChannelMatrix.display;        
        var displayedString =  isShown ? ' displayed' : '';
        var channelName = ivMaxPointChannelMatrix.channelName;
        if(typeof ivMaxPointChannelMatrix.channelIndex !== 'undefined'){
            channelName += ' (' + ivMaxPointChannelMatrix.channelIndex.toString() + ')';
        }
        element.innerHTML = '<button class="btn btn-sm channelTag'+ displayedString +'" onclick="toogleChannelDisplay(' + i + ')" >' + channelName + '</button>';
        document.getElementById('channelLegend').appendChild(element);

        if (isShown) {  

            var computedStyle = getComputedStyle(element);
            var fillStyleColor = computedStyle.getPropertyValue('--channelColor');

            for (let averagedPoint of ivMaxPointChannelMatrix.values) {
                ctx.beginPath();
                ctx.fillStyle = fillStyleColor;
                ctx.arc(getIvXValue(width, averagedPoint.referencePotential, 200, ivX0RelPos), getIvYValue(height, averagedPoint.averageCurrent, 2 * ivMaxAmp, ivY0RelPos), 4, 0, Math.PI * 2, false);
                ctx.fill();
            }

            
            if(typeof ivMaxPointChannelMatrix.fitStatus !== 'undefined'){
                //fitted curve
                
                ctx.beginPath();
                ctx.setLineDash([]);
                ctx.strokeStyle = fillStyleColor;
                ctx.lineWidth = '1.5';
                ctx.moveTo(getIvXValue(width, ivMaxPointChannelMatrix.fittedXValues[0], 200, ivX0RelPos), getIvYValue(height, ivMaxPointChannelMatrix.fittedYValues[0], 2 * ivMaxAmp, ivY0RelPos));
                for (let j = 1; j < ivMaxPointChannelMatrix.fittedXValues.length; j++) {
                    ctx.lineTo(getIvXValue(width, ivMaxPointChannelMatrix.fittedXValues[j], 200, ivX0RelPos), getIvYValue(height, ivMaxPointChannelMatrix.fittedYValues[j], 2 * ivMaxAmp, ivY0RelPos));
                }
                ctx.stroke();

                //conductance curve
                
                condCtx.beginPath();
                condCtx.strokeStyle = fillStyleColor;;
                condCtx.setLineDash([]);
                condCtx.lineWidth = '2.5';
                condCtx.moveTo(getIvXValue(condWidth, ivMaxPointChannelMatrix.fittedXValues[0], 200), getIvYValue(condHeight, ivMaxPointChannelMatrix.fittedCondYValues[0], 1.5, 0.833));
                for (let j = 1; j < ivMaxPointChannelMatrix.fittedXValues.length; j++) {
                    condCtx.lineTo(getIvXValue(condWidth, ivMaxPointChannelMatrix.fittedXValues[j], 200), getIvYValue(condHeight, ivMaxPointChannelMatrix.fittedCondYValues[j], 1.5, 0.833));
                }
                condCtx.stroke();

            }
        } 
    }    
}

function numberOfNameOccurences(channelName){
    var n = 0;
    for (let ivMaxPointChannelMatrix of ivMaxPointTotalMatrix) {
        if (ivMaxPointChannelMatrix.channelName == channelName) {
            n++;
        }
    }
    return n;
}

function drawConductanceGrid(){
    //conductance grid
    let ampStep = Math.round(ivMaxAmp / 6);
    let voltStep = 10;
    canvas = document.getElementById("conductanceCanvas");
        ctx = canvas.getContext("2d");

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpi, dpi);
        height = canvas.getBoundingClientRect().height;
        width = canvas.getBoundingClientRect().width;

        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = 'black';

        ctx.beginPath();
        ctx.setLineDash([1.5, 1.5]);
        ctx.lineWidth = '1.5';
        ctx.moveTo(0, getIvYValue(height, 0, 1.5, 0.833));
        ctx.lineTo(width - 30, getIvYValue(height, 0, 1.5, 0.833));
        ctx.moveTo(0, getIvYValue(height, 1, 1.5, 0.833));
        ctx.lineTo(width - 30, getIvYValue(height, 1, 1.5, 0.833));
        ctx.moveTo(getIvXValue(width, 0, 200), getIvYValue(height, 1.03, 1.5, 0.833));
        ctx.lineTo(getIvXValue(width, 0, 200), getIvYValue(height, -0.03, 1.5, 0.833));
        ctx.stroke();

        ctx.beginPath();

        ctx.setLineDash([1.5, 1.5]);
        ctx.strokeStyle = '#6b6b6b';
        ctx.lineWidth = '1';
        ctx.font = "11px Arial";
        ctx.textBaseline = 'top';
        ctx.textAlign = "center";

        ctx.moveTo(0, getIvYValue(height, 0.25, 1.5, 0.833));
        ctx.lineTo(width - 30, getIvYValue(height, 0.25, 1.5, 0.833));
        ctx.moveTo(0, getIvYValue(height, 0.5, 1.5, 0.833));
        ctx.lineTo(width - 30, getIvYValue(height, 0.5, 1.5, 0.833));
        ctx.moveTo(0, getIvYValue(height, 0.75, 1.5, 0.833));
        ctx.lineTo(width - 30, getIvYValue(height, 0.75, 1.5, 0.833));

        ctx.fillText('0', getIvXValue(width, 0, 200), getIvYValue(height, -0.03, 1.5, 0.833));

        for (let i = 1; i < 10; i++) {
            ctx.moveTo(getIvXValue(width, i * voltStep, 200), getIvYValue(height, 1.03, 1.5, 0.833));
            ctx.lineTo(getIvXValue(width, i * voltStep, 200), getIvYValue(height, -0.03, 1.5, 0.833));
            let voltString = (i * voltStep).toString();

            if (i == 9) {

                voltString += ' mV'
            }

            ctx.fillText(voltString, getIvXValue(width, i * voltStep, 200), getIvYValue(height, -0.03, 1.5, 0.833));



            ctx.moveTo(getIvXValue(width, -1 * i * voltStep, 200), getIvYValue(height, 1.03, 1.5, 0.833));
            ctx.lineTo(getIvXValue(width, -1 * i * voltStep, 200), getIvYValue(height, -0.03, 1.5, 0.833));
            voltString = (-1 * i * voltStep).toString();
            ctx.fillText(voltString, getIvXValue(width, -1 * i * voltStep, 200), getIvYValue(height, -0.03, 1.5, 0.833));
        }
        ctx.stroke();

        ctx.font = "bold 11px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = 'middle';
        ctx.fillText('0', width, getIvYValue(height, 0, 1.5, 0.833));
        ctx.fillText('0.25', width, getIvYValue(height, 0.25, 1.5, 0.833));
        ctx.fillText('0.5', width, getIvYValue(height, 0.5, 1.5, 0.833));
        ctx.fillText('0.75', width, getIvYValue(height, 0.75, 1.5, 0.833));
        ctx.fillText('1', width, getIvYValue(height, 1, 1.5, 0.833));
}

function getIvXValue(width, x, amp, yShiftFactor = 0.5) {
    return Math.round((x / amp) * (width - 30) + Math.round((width - 30) * yShiftFactor) + 15);
}

function getIvYValue(height, y, amp, yShiftFactor = 0.5) {
    return Math.round(-1 * (y / amp) * (height - 30) + Math.round((height - 30) * yShiftFactor) + 15);
}

function calculateMembranePotential(permeabilities) {
    //generalisation for divalent ions see https://reader.elsevier.com/reader/sd/pii/0025556476900183?token=10D48EF152A0A3957A80E434135B74531F4AA06B4DC1AE53AD665C3D2EC0E464D4D8DD2C0967654A06278F3D94F61B24&originRegion=eu-west-1&originCreation=20221126202218

    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];    

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");

    var naIn, kIn, caIn, clIn;
    [naIn, kIn, caIn, clIn] = getInternalConcentrations();

    //see paper above for variable definitions
    var s1 = pNa * naEx + pK * kEx + pCl * clIn;
    var t1 = pNa * naIn + pK * kIn + pCl * clEx;
    var s2 = pCa * caEx;
    var t2 = pCa * caIn;

    var nummerator = s1 - t1 + Math.sqrt((s1 + t1) ** 2 + 16 * (t1 * s2 + t2 * s1 + 4 * t2 * s2));
    var denominator = 2 * (t1 + 4 * t2);

    return rtfConstant * Math.log(nummerator / denominator);
}

function goldmanCurrentEquation(z, P, Vm, Co, Ci,) {
    const F = 96.48533212;
    const R = 8.314462618;
    const T = 310;
    const e = Math.E;
    var exponent = (- z * F * Vm) / (R * T);

    return ((Ci - Co * e ** exponent) / (1 - e ** exponent)) * (z ** 2 * F ** 2 * Vm * P) / (R * T);

}

function useSimpleCurrentModel() {
    return ($("input[name='currentSimModeRadio']:checked").val() == "simple");
}

function calculateCurrentForGivenPotential(potential, permeabilities) {
    var pNa = permeabilities[0];
    var pK = permeabilities[1];
    var pCa = permeabilities[2];
    var pCl = permeabilities[3];

    var naEx = getSelectedIon("Na");
    var kEx = getSelectedIon("K");
    var caEx = getSelectedIon("Ca");
    var clEx = getSelectedIon("Cl");

    var naIn, kIn, caIn, clIn;
    [naIn, kIn, caIn, clIn] = getInternalConcentrations();

    if (useSimpleCurrentModel()) {
        return pNa * (potential - calculateMembranePotential([1,0,0,0])) + pK * (potential - calculateMembranePotential([0,1,0,0])) + pCa * (potential - calculateMembranePotential([0,0,1,0])) + pCl * (potential - calculateMembranePotential([0,0,0,1])) + getNoise(4);  
    } else {
        var INa = goldmanCurrentEquation(1, pNa, potential, naEx, naIn);
        var IK = goldmanCurrentEquation(1, pK, potential, kEx, kIn);
        var ICl = goldmanCurrentEquation(-1, pCl, potential, clEx, clIn);
        var ICa = goldmanCurrentEquation(2, pCa, potential, caEx, caIn);

        return (INa + IK + ICl + ICa) + getNoise(4);
    }
}

function recordPassive() {
    var time = timerCounterToTime(passiveCounter);

    var permeabilities = getPermeabilities(lastPotential, null);

    var membranePotential = calculateMembranePotential(permeabilities);

    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);
    var potential = juctionPotential + offsetPotential + noise + membranePotential;
    lastPotential = potential;

    var current = calculateCurrentForGivenPotential(potential, permeabilities);

    updateOutputFields(potential, current);

    if (voltageClampCounter == (30000 / deltaT)) {
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



    var potential = juctionPotential + offsetPotential + clampPotential; //calculate actual membranepotential !!!!!!!

    var permeabilities = getPermeabilities(clampPotential, null);

    var current = calculateCurrentForGivenPotential(potential, permeabilities);
    updateOutputFields(clampPotential, current);


    if (voltageClampCounter == (30000 / deltaT)) {
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



    var potential = juctionPotential + offsetPotential + clampPotential; //calculate actual membranepotential !!!!!!!


    var permeabilities = getPermeabilities(clampPotential, timeAtClampPotential);



    var current = calculateCurrentForGivenPotential(potential, permeabilities);
    updateOutputFields(clampPotential, current);

    ivDataMatrix[ivCurveCounter] = [clampPotential, current];

    if (ivCurveCounter == (30000 / deltaT)) {
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
    var deltaTimeVmem = 1.50;
    var deltaTimePulse = 1.1;
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
    var time = timerCounterToTime(bathTimerCounter);

    var permeabilities = getPermeabilities(lastPotential, null);

    var membranePotential = calculateMembranePotential(permeabilities);


    var juctionPotential = getJunctionPotential();
    var offsetPotential = parseFloat($('#offsetPotentialInput').val());
    var noise = getNoise(0.5);
    var potential = juctionPotential + offsetPotential + noise + membranePotential;
    lastPotential = potential;

    var current = calculateCurrentForGivenPotential(potential, permeabilities);


    updateOutputFields(potential, current);


    if (bathTimerCounter == (30000 / deltaT)) {
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
        case '1': //daueroffen für K+
            if (useSimpleCurrentModel()) {
                return [0, 4, 0, 0];
            } else {
                return [0, 0.03, 0, 0];
            }
            break;
        case '2'://kir
            var slope = 4;
            //var vhalf = -25;
            var vhalf = calculateMembranePotential([0,1,0,0]) + 60; //Triebkraftabhängigkeit
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0;
            var c = 0.05;
            var d = 10;
            if (timeAtPotential != null) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }
            if (!useSimpleCurrentModel()) {
                conductance *= 0.0089;
            }
            return [0, conductance, 0, 0];
            break;
        case '3': //kv ohne kinetik
            var slope = -4;
            var vhalf = -50;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            if (!useSimpleCurrentModel()) {
                conductance *= 0.0089;
            }
            return [0, conductance, 0, 0];
            break;
        case '8'://kv
            var slope = -4;
            var vhalf = -50;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0.05;
            var c = 0.01;
            var d = 0.4;
            if (timeAtPotential != null && timeAtPotential != 0) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }
            if (!useSimpleCurrentModel()) {
                conductance *= 0.0089;
            }
            return [0, conductance, 0, 0];
            break;
        case '4'://Nav ohne kinetic
            var slope = -6;
            var vhalf = -45;
            var conductance = 4 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            if (!useSimpleCurrentModel()) {
                conductance *= 0.00416;
            }
            return [conductance, 0, 0, 0];
            break;
        case '9'://Nav
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
            if (!useSimpleCurrentModel()) {
                conductance *= 0.0043;
            }
            return [conductance, 0, 0, 0];
            break;
        case '7'://Cav
            var slope = -6;
            var vhalf = -15;
            var conductance = 3 * (1 - (1 / (1 + Math.exp((potential - vhalf) / (-1 * slope)))));
            var a = 0.86403262;
            var b = 0.05;
            var c = 0.01;
            var d = 0.6;
            if (timeAtPotential != null) {
                var correction = (1 / a) * (1 - 1 / (1 + Math.exp((timeAtPotential - b) / (c)))) * Math.exp((-timeAtPotential + b) / (d));
                conductance *= correction;
            }
            if (!useSimpleCurrentModel()) {
                conductance /= 2.5;
            }
            return [0, 0, conductance, 0];
            break;
        case '6': //daueroffen Cl-
            if (useSimpleCurrentModel()) {
                return [0, 0, 0, 3];
            } else {
                return [0, 0, 0, 0.038];
            }
            break;
        case '5':  //daueroffen für Na+
            if (useSimpleCurrentModel()) {
                return [2, 0, 0, 0];
            } else {
                return [0.0077, 0, 0, 0];
            }
            break;
        case '10':  //daueroffen für Na+ K+            
            if (useSimpleCurrentModel()) {
                return [1.5, 0.8, 0, 0];
            } else {
                return [0.00463, 0.003, 0, 0];
            }
            break;
    }


}

function getSelectedIon(ion) {
    var selectedIon = '#' + ion + $('input[name=selectedSolution]:checked').val();
    var concentration = parseFloat($(selectedIon).val());
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
    updateOutputFields(potential, current);

    if (bathTimerCounter == (30000 / deltaT)) {

        bathTimerCounter = 0;
        canvasPointsMatrix.length = 0;

    } else {
        bathTimerCounter++;

        canvasPointsMatrix.push([time, potential, current]);

        paintMainCanvas();
    }

}

function paintMainCanvas() {
    drawGrid('ampageCanvas', maxAmp, ' nA', ampOffset);
    drawGrid('voltageCanvas', maxVolt, ' mV', voltOffset);
    if (canvasPointsMatrix.length > 1) {
        drawRecord('ampageCanvas', maxAmp, ampOffset, 'black', 2);
        drawRecord('voltageCanvas', maxVolt, voltOffset, 'red', 1);
    }
}

function drawRecord(canvasName, halfAmplitude, offset, color, a) { // a  = 1 if potential, 2 if current  
    var canvas = document.getElementById(canvasName);
    var ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpi, dpi);

    var height = canvas.getBoundingClientRect().height;
    var width = canvas.getBoundingClientRect().width;

    ctx.lineWidth = '2';
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    var topMargin = 15;

    var time = canvasPointsMatrix[0][0];
    var value = canvasPointsMatrix[0][a];

    var xPosition = getRecordXValue(time, 30, width);
    var yPosition = getRecordYValue(value, halfAmplitude, offset, height, topMargin);

    ctx.beginPath();
    ctx.moveTo(xPosition, yPosition);

    for (let i = 1; i < canvasPointsMatrix.length; i++) {
        time = canvasPointsMatrix[i][0];
        value = canvasPointsMatrix[i][a];

        xPosition = getRecordXValue(time, 30, width);
        yPosition = getRecordYValue(value, halfAmplitude, offset, height, topMargin);
        ctx.lineTo(xPosition, yPosition);
    }
    ctx.stroke();
}

function getRecordXValue(time, maxtime, width) {
    return Math.round((time / maxtime) * width);
}

function getRecordYValue(value, halfAmplitude, offset, height, topMargin) {
    return Math.round(height / 2 - (value / halfAmplitude) * (height / 2 - topMargin) + offset * ((height - 2 * topMargin) / 12));
}

function drawGrid(canvasName, halfAmplitude, unit, offset) {
    var canvas = document.getElementById(canvasName);
    var ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpi, dpi);

    var height = canvas.getBoundingClientRect().height;
    var width = canvas.getBoundingClientRect().width;

    ctx.clearRect(0, 0, width, height);

    var xStep = width / 60; //width of 1 second

    var ordinateStep = halfAmplitude / 6; //difference in ordinate value between two horizontal lines

    var deltaY = (height - 30) / 12; //difference in canvas y values between two horizontal lines

    //draw vertical lines
    ctx.strokeStyle = "black";
    ctx.lineWidth = "1.25";
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xStep, 12);
    ctx.lineTo(xStep, height - 12);
    ctx.stroke();

    //draw horizontal lines
    for (let z = 0; z < 13; z++) {
        //calculate ordinate value
        var ordinateValue = halfAmplitude - (z - offset) * ordinateStep;
        //y value of line
        var yLine = Math.round(15 + z * deltaY);

        if (Math.abs(ordinateValue) < 0.001) {
            ctx.strokeStyle = "black";
            ctx.lineWidth = "1.25";
            ctx.setLineDash([]);
            ctx.beginPath();

            ctx.moveTo(0, yLine);
            ctx.lineTo(width, yLine);

            var yUp = yLine - 3;
            var yDown = yLine + 3;

            for (let q = 2; q < 60; q++) {
                var x = Math.round(q * xStep);
                ctx.moveTo(x, yUp);
                ctx.lineTo(x, yDown);
            }
            ctx.stroke();
            ctx.font = "13px Arial";
            ctx.textBaseline = 'top';
            ctx.textAlign = "right";
            ctx.fillText("30 s", width - 3, yLine + 7);

        } else {
            //draw dotted horizontal line
            ctx.lineWidth = "1";
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#8f8f8f";



            ctx.beginPath();
            ctx.moveTo(0, yLine);
            ctx.lineTo(width, yLine);
            ctx.stroke();

            ctx.font = "13px Arial";
            ctx.textBaseline = 'middle';
            ctx.textAlign = "left";

            var ordinateText = ordinateValue.toString();
            if (z == 0) {
                ordinateText += unit;
            }
            ctx.fillText(ordinateText, 23, yLine);
        }
    }
}

function getJunctionPotential() {
    var extracellularConcentrations = [getSelectedIon("Na"), getSelectedIon("K"), getSelectedIon("Ca"), getSelectedIon("Cl")];

    for (let junctionPotential of junctionPotentials) {
        if (junctionPotential.extracellularConcentrations[0] == extracellularConcentrations[0]
            && junctionPotential.extracellularConcentrations[1] == extracellularConcentrations[1]
            && junctionPotential.extracellularConcentrations[2] == extracellularConcentrations[2]
            && junctionPotential.extracellularConcentrations[3] == extracellularConcentrations[3]) {
            return junctionPotential.potential;
        }
    }
    return calculateJunctionPotential(extracellularConcentrations);
}

function calculateJunctionPotential(extracellularConcentrations) {
    var junctionPotential = new Object();

    var pipetteConcentrations = [0, 3000, 0, 3000];
    var valencies = [1, 1, 2, -1];
    var mobilities = [0.682, 1, 0.81, 1.0388];

    var sum1 = 0;
    var sum2 = 0;
    var sum3 = 0;
    var sum4 = 0;

    for (let i = 0; i < 4; i++) {
        sum1 += valencies[i] * valencies[i] * mobilities[i] * pipetteConcentrations[i];
        sum2 += valencies[i] * valencies[i] * mobilities[i] * extracellularConcentrations[i];
        sum3 += valencies[i] * mobilities[i] * (extracellularConcentrations[i] - pipetteConcentrations[i]);
        sum4 += valencies[i] * valencies[i] * mobilities[i] * (extracellularConcentrations[i] - pipetteConcentrations[i]);
    }

    junctionPotential.potential = rtfConstant * (sum3 / sum4) + Math.log(sum1 / sum2);

    junctionPotential.extracellularConcentrations = extracellularConcentrations;
    junctionPotentials.push(junctionPotential);
    return junctionPotential.potential;
}

function getInternalConcentrations() {
    return [12, 155, 0.0001, 4];
}

function getNoise(a) {
    return -a + Math.random() * 2 * a;
}

function average(nums) {
    return nums.reduce((a, b) => (a + b)) / nums.length;
}

function resizeCanvas() {
    var canvas = document.getElementById("ampageCanvas");
    canvas.width = dpi * canvas.offsetWidth;
    canvas.height = dpi * canvas.offsetHeight;
    canvas = document.getElementById("voltageCanvas");
    canvas.width = dpi * canvas.offsetWidth;
    canvas.height = dpi * canvas.offsetHeight;
    canvas = document.getElementById("analysisCanvas");
    canvas.width = dpi * canvas.offsetWidth;
    canvas.height = dpi * canvas.offsetHeight;
    canvas = document.getElementById("conductanceCanvas");
    canvas.width = dpi * canvas.offsetWidth;
    canvas.height = dpi * canvas.offsetHeight;

    paintMainCanvas();

    if (typeof ivMaxPointTotalMatrix !== 'undefined') {
        if (ivMaxPointTotalMatrix.length > 0) {
            paintIvCanvas();
        }
    }
}

function timerCounterToTime(a) {
    return (a / (30000 / deltaT)) * 30;
}

function naCurrentModel(x, p) {
    return (p[0] * x + p[1]) * conductanceModel(x, p);
}

function conductanceModel(x, p) {
    return (1 - 1 / (1 + Math.exp((x - p[2]) / p[3])));
}

function updateOutputFields(potential, current) {
    if (updateOutputFieldsCounter > 10) {
        $('#potentialOutput').val(potential.toFixed(1));
        $('#currentOutput').val(current.toFixed(0));
        updateOutputFieldsCounter = 0;
    } else {
        updateOutputFieldsCounter++;
    }
}

function lineModel(x, p) {
    return (p[0] * x + p[1]);
}

function toogleChannelDisplay(i){
    ivMaxPointTotalMatrix[i].display = !ivMaxPointTotalMatrix[i].display;
    paintIvCanvas();
}