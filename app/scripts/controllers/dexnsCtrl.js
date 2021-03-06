'use strict';
var dexnsCtrl = function ($scope, $sce, $rootScope, walletService, backgroundNodeService) {
    $scope.ajaxReq = ajaxReq;
    $scope.hideEnsInfoPanel = false;
    $scope.networks = globalFuncs.networks;

    $scope.tx = {
        gasLimit: '200000',
        data: '',
        to: '',
        unit: "ether",
        value: 0,
        gasPrice: null
    };

    walletService.wallet = null;

    $scope.priceDEXNS = "LOADING...";
    $scope.DexNSName;
    $scope.dexnsConfirmModalModal = new Modal(document.getElementById('dexnsConfirmModal'));


    $scope.priceDEXNS = ("0.1 ETC");
    var namePrice = 0.1;


    /* 0 -> nothing
   *  1 -> user
   *  2 -> token
   *  3 -> contract
   *  4 -> update Name
   *  5 -> access Name content
   *  6 -> step 2 register Name
   *  7 -> confirmation
   */
    const statusCodes = {
        nothing: 0,
        'user': 1,
        'token': 2,
        'contract': 3,
        'update Name': 4,
        'access Name content': 5,
        'step 2 register Name': 6,
        'confirmation': 7,
    };

    $scope.dexns_status = statusCodes.nothing; //0;


    var DEXNSnetwork = 'ETC'; // DexNS network is always ETC!
    var DexNSFrontendABI = require('../abiDefinitions/etcAbi.json')[4];

    // 19 => namePrice

    var DexNSABI = require('../abiDefinitions/etcAbi.json')[5];

    // 16 => endtimeOf
    // 1  => registerName
    // 22 => registerAndUpdate

    var DEXNSFrontendAddress = DexNSFrontendABI.address;
    var DEXNSAddress = DexNSABI.address;
    DexNSABI = JSON.parse(DexNSABI.abi);
    DexNSFrontendABI = JSON.parse(DexNSFrontendABI.abi);



    // TODO
    $scope.$watch(function () {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function () {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
        $scope.wd = true;
        $scope.wallet.setBalance();
        $scope.wallet.setTokens();
    });

    var DexNSContract = {
        functions: [],
    };

    var DexNSFrontendContract = {
        functions: [],
    };
    for (var i in DexNSABI) {
        if (DexNSFrontendABI[i].type == "function") {
            DexNSFrontendABI[i].inputs.map(function (i) {
                i.value = '';
            });
            DexNSFrontendContract.functions.push(DexNSFrontendABI[i]);
        }
    }
        for (var i in DexNSABI) {
            if (DexNSFrontendABI[i].type == "function") {
                DexNSFrontendABI[i].inputs.map(function (i) {
                    i.value = '';
                });
                DexNSFrontendContract.functions.push(DexNSFrontendABI[i]);
            }
        }
        var namePriceFunc = DexNSFrontendContract.functions[19];
        var fullPriceFuncName = ethUtil.solidityUtils.transformToFullName(namePriceFunc);
        var priceSig = ethFuncs.getFunctionSignature(fullPriceFuncName);


    $scope.getDexNSPrice = function () {

        nodes.nodeList[backgroundNodeService.backgroundNode].lib.getEthCall({to: DEXNSFrontendAddress, data: '0x' + priceSig}, function (data) {
            var outTypes = namePriceFunc.outputs.map(function (i) {
                return i.type;
            });
            data.data = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''))[0];
            if (data.error) uiFuncs.notifier.danger(data.msg);
            else {


                namePrice = etherUnits.toEther(data.data, 'wei');
				console.log(namePrice);
                $scope.priceDEXNS = (etherUnits.toEther(data.data, 'wei')) + " ETC";
				console.log($scope.priceDEXNS);
            }
        });


    }

    $scope.openRegisterName = function () {
        $scope.dexns_status = statusCodes.user; // 1 -> user
    }

    $scope.checkDexNSName = function () {
        var checkFunc = DexNSFrontendContract.functions[16];
        var fullcheckFunc = ethUtil.solidityUtils.transformToFullName(checkFunc);
        var checkSig = ethFuncs.getFunctionSignature(fullcheckFunc);
        var _typeName = ethUtil.solidityUtils.extractTypeName(fullcheckFunc);

        var types = _typeName.split(',');
        types = types[0] == "" ? [] : types;
        var values = [];
        checkFunc.inputs[0].value = $scope.DexNSName;
        for (var i in checkFunc.inputs) {
            if (checkFunc.inputs[i].value) {
                if (checkFunc.inputs[i].type.indexOf('[') !== -1 && checkFunc.inputs[i].type.indexOf(']') !== -1) values.push(checkFunc.inputs[i].value.split(','));
                else values.push(checkFunc.inputs[i].value);
            } else values.push('');
        }

        var _DexNSData = '0x' + checkSig + ethUtil.solidityCoder.encodeParams(types, values);

        nodes.nodeList[backgroundNodeService.backgroundNode].lib.getEthCall({to: DEXNSFrontendAddress, data: _DexNSData}, function (data) {
            var outTypes = checkFunc.outputs.map(function (i) {
                return i.type;
            });

            data.data = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''))[0];


            if (data.error) uiFuncs.notifier.danger(data.msg);
            else {
                var _time = new Date().getTime();
                var _renderedTime = new BigNumber(_time);
                if (ajaxReq.type != "ETC") {
                    $scope.notifier.danger("DexNS accepts only $ETC for gas payments! You should switch to ETC node first to register your name.");
                }
                else if (_renderedTime > data.data) {
                    $scope.dexns_status = statusCodes['step 2 register Name'];
                    $scope.notifier.info("This name is available for registration.");
                }
                else {
                    $scope.notifier.danger("This name is already registered! You should try to register another name.");
                }
            }
        });
    }

    $scope.registerDexNSName = function () {

        if ($scope.wallet == undefined) {
            $scope.notifier.danger("Unlock your wallet first!");
        } else {
            ajaxReq.getTransactionData($scope.wallet.getAddressString(), function (data) {
                if (data.error) $scope.notifier.danger(data.msg);
                data = data.data;

                var func = DexNSFrontendContract.functions[1];
                var fullFunc = ethUtil.solidityUtils.transformToFullName(func);
                var funcSig = ethFuncs.getFunctionSignature(fullFunc);
                var _typeName = ethUtil.solidityUtils.extractTypeName(fullFunc);

                $scope.tx.gasLimit = 200000;
                $scope.tx.to = DEXNSFrontendAddress;
                $scope.tx.value = namePrice;
                $scope.tx.gasPrice = data.gasprice;
                $scope.tx.nonce = data.nonce;

                var types = _typeName.split(',');
                types = types[0] == "" ? [] : types;
                var values = [];
                func.inputs[0].value = $scope.DexNSName;
                values.push(func.inputs[0].value);

                $scope.tx.data = '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, values);

                var txData = uiFuncs.getTxData($scope);
                txData.gasPrice = data.gasprice;
                txData.nonce = data.nonce;

                uiFuncs.generateTx(txData, function (rawTx) {
                    if (!rawTx.isError) {
                        $scope.generatedDexNSTxs = [];
                        $scope.generatedDexNSTxs.push(rawTx.signedTx);
                        $scope.dexns_status = statusCodes.confirmation;
                        $scope.dexnsConfirmModalModal.open();
                    } else {
                        $scope.notifier.danger(rawTx.error);
                    }
                });
            });
        }
        //$scope.dexns_status = 7;
        //$scope.dexnsConfirmModalModal.open();
    }

    $scope.sendTxStatus = "";
    $scope.sendTx = function () {
        $scope.dexnsConfirmModalModal.close();
        var signedTx = $scope.generatedDexNSTxs.shift();
        uiFuncs.sendTx(signedTx, function (resp) {
            if (!resp.isError) {
                var linkStatus = "http://gastracker.io/tx/" + resp.data;
                //console.log(linkStatus);
                $scope.sendTxStatus = globalFuncs.successMsgs[2] + '<a target="_self" href="{{linkStatus}}" target="_blank"> http://gastracker.io/tx/' + resp.data + ' </a>';
                // console.log("http://gastracker.io/tx/" + resp.data + "#");
                $scope.notifier.info($scope.sendTxStatus, 0);
                if ($scope.generatedDexNSTxs.length) $scope.sendTx();
                else $scope.sendTxStatus = ''
            } else {
                $scope.notifier.danger(globalFuncs.errorMsgs[17].replace('{}', ajaxReq.type));
            }
        });
    }

    $scope.getDexNSPrice();

    $scope.toTimestamp = function (date) {
        var dateSplitted = date.split('-'); // date must be in DD-MM-YYYY format
        var formattedDate = dateSplitted[1] + '/' + dateSplitted[0] + '/' + dateSplitted[2];
        return new Date(formattedDate).getTime();
    }
}

module.exports = dexnsCtrl;
