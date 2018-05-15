'use strict';


var swapCtrl = function ($scope, $rootScope, $interval, walletService) {

    //$scope.walletService = walletService;


    const bitcoinExplorer = `https://blockchain.info/tx/[[txHash]]`;

    const lStorageKey = "swapOrder";


    // sort swapOrder coins
    const popularCoins = ['ETC', 'CLO', 'BTC', 'XMR', 'ZEC'];

    const ethCoins = ['ETC', 'ETH', 'UBQ', 'CLO'];


    // priceTicker in page header
    const priceTickers = ['ETC'];


    let priceTicker = {};

    priceTickers.forEach(ticker => {
        priceTicker[ticker + 'BTC'] = 1;

        priceTicker['BTC' + ticker] = 1;

    });


    const verifyToAddress = function (coin) {

        if ($scope.swapOrder.toCoin.toUpperCase() === 'BTC') {

            return Validator.isValidBTCAddress($scope.swapOrder.toCoin)

        } else if (ethCoins.includes($scope.swapOrder.toCoin)) {


            return Validator.isValidAddress($scope.swapOrder.toCoin);
        }
        else {

            return true;
        }
    };


    Object.assign($scope, {
        errorCount: 0,
        ethCoins,
        availableCoins: [],
        parentTxConfig: {},
        showedMinMaxError: false,
        changeNow: new changeNow(),
        priceTicker,
        stage: 1,
        orderResult: null,
        progressCheck: null,
    });

    $scope.initChangeNow = async function () {


        const currencies = await $scope.changeNow.getCurrencies();

        if (currencies) {


            $scope.availableCoins = currencies.sort($scope.coinOrder);


            await Promise.all(priceTickers.map(async (ticker) => {

                const conversionRatio = await $scope.changeNow.estimateConversion(ticker.toUpperCase());

                if (conversionRatio) {


                    Object.assign($scope, {
                        priceTicker: {
                            [ticker + 'BTC']: 1 / conversionRatio,
                            ['BTC' + ticker]: conversionRatio
                        }
                    });
                }

            }));
        }
    }


    const initValues = function () {


        Object.assign($scope, {
            stage: 1,
            orderResult: {
                "status": null,
                "payinAddress": null,
                "payoutAddress": null,
                "fromCurrency": null,
                "toCurrency": null,
                "id": null,
                "updatedAt": null,
                "expectedSendAmount": null,
                "expectedReceiveAmount": null,
                progress: {
                    status: null,
                    bar: null//getProgressBarArr(4, 5),
                }
            },
            swapOrder: {
                fromCoin: 'etc',
                toCoin: 'btc',
                isFrom: false,
                fromVal: null,
                toVal: 1,
                toAddress: null,
                swapRate: null,
                swapPair: null,
            }

        });
    }


    $scope.verifyMinMaxValues = function () {


        return Validator.isPositiveNumber($scope.swapOrder.toVal) &&
            Validator.isPositiveNumber($scope.swapOrder.fromVal) &&
            !$scope.showedMinMaxError;


    };


    $scope.setOrderCoin = async function (isFrom, coin) {
        if (isFrom) $scope.swapOrder.fromCoin = coin;
        else $scope.swapOrder.toCoin = coin;
        if ($scope.swapOrder.fromCoin === $scope.swapOrder.toCoin)
            for (var i in $scope.availableCoins)
                if ($scope.availableCoins[i] !== $scope.swapOrder.fromCoin) {
                    $scope.swapOrder.toCoin = $scope.availableCoins[i];
                    break;
                }
        $scope.swapOrder.swapPair = $scope.swapOrder.fromCoin + "/" + $scope.swapOrder.toCoin;

        $scope.dropdownFrom = $scope.dropdownTo = false;
        await $scope.updateEstimate(isFrom);

    }
    $scope.updateEstimate = async function (isFrom) {


        let amount = isFrom ? parseFloat($scope.swapOrder.fromVal) : parseFloat($scope.swapOrder.toVal);


        if (!Validator.isPositiveNumber(amount)) {

            return false;

        }


        let fromCoin, toCoin;


        $scope.swapOrder.isFrom = isFrom;
        if (isFrom) {


            if ($scope.stage === 1) {

                $scope.swapOrder.toVal = '...';
            }

            fromCoin = $scope.swapOrder.fromCoin;
            toCoin = $scope.swapOrder.toCoin;


        } else {

            if ($scope.stage === 1) {

                $scope.swapOrder.fromVal = '...';

            }

            toCoin = $scope.swapOrder.fromCoin;

            fromCoin = $scope.swapOrder.toCoin;
        }

        const result = await $scope.changeNow.exchangeAmount(amount, fromCoin, toCoin);


        if (result) {


            if (isFrom) {

                $scope.swapOrder.toVal = result.estimatedAmount;
                $scope.swapOrder.fromVal = amount;

            } else {


                $scope.swapOrder.toVal = amount;
                $scope.swapOrder.fromVal = result.estimatedAmount;


            }
        } else {


            $scope.notifier.danger('error connecting to server');

            Object.assign($scope, {
                swapOrder: {
                    toVal: '',
                    fromVal: '',
                }
            });

        }


    };

    $scope.setFinalPrices = function () {
        $scope.showedMinMaxError = false;

        if (!Validator.isPositiveNumber($scope.swapOrder.fromVal) ||
            !Validator.isPositiveNumber($scope.swapOrder.toVal)) throw globalFuncs.errorMsgs[0];

        $scope.stage = 2;
        $scope.updateEstimate($scope.swapOrder.isFrom);

    };


    const getProgressBarArr = function (index, len) {


        var tempArr = [];
        for (var i = 0; i < len; i++) {
            if (i < index) tempArr.push('progress-true');
            else if (i === index) tempArr.push('progress-active');
            else tempArr.push('');
        }
        return tempArr;
    }
    var isStorageOrderExists = function () {
        var order = globalFuncs.localStorage.getItem(lStorageKey, null);
        return order && Validator.isJSON(order);
    }
    var setOrderFromStorage = function () {
        const order = JSON.parse(globalFuncs.localStorage.getItem(lStorageKey, null));
        $scope.orderResult = order;

    }
    $scope.saveOrderToStorage = function (order) {

        globalFuncs.localStorage.setItem(lStorageKey, JSON.stringify(order))
    }

    $scope.processOrder = async function () {

        if (['new', 'waiting'].includes($scope.orderResult.status.toLowerCase())) {


            if (Validator.isValidAddress($scope.orderResult.payinAddress)) {



                //TODO: only switch if different

                //const node = globalFuncs.getCurNode();

                // if (nodes.nodeList[node].type.toUpperCase() !== $scope.orderResult.fromCurrency.toUpperCase()) {

                $rootScope.$broadcast('ChangeNode', $scope.orderResult.fromCurrency.toUpperCase());

                //}


                const {orderResult: {payinAddress, expectedSendAmount}} = $scope;

                Object.assign($scope.parentTxConfig, {
                    to: ethUtil.toChecksumAddress(payinAddress),
                    value: expectedSendAmount,
                    sendMode: 'ether'
                });


            }
        }


        const statuses = {
            new: 'new',
            waiting: 'waiting',
            confirming: 'confirming',
            exchanging: 'exchanging',
            sending: 'sending',
            finished: 'finished',
            failed: 'failed',
            refunded: 'refunded',
            expired: 'expired',
        };


        $scope.progressCheck = $interval(async () => await handleProgressCheck(), 1000 * 15);


        await handleProgressCheck();

        async function handleProgressCheck() {

            // https://changenow.io/exchange/txs/b3c25544d5a034


            const data = await $scope.changeNow.transactionStatus($scope.orderResult.id);


            if (!data) {

                $scope.notifier.danger('error checking tx');

            }

            /*

            {
              id: "b712390255",
              status: "finished",
              payinConfirmations: 12,
              hash: "transactionhash",
              payinHash: "58eccbfb713d430004aa438a",
              payoutHash: "58eccbfb713d430004aa438a",
              payinAddress: "58eccbfb713d430004aa438a",
              payoutAddress: "0x9d8032972eED3e1590BeC5e9E4ea3487fF9Cf120",
              payinExtraId: "123456",
              payoutExtraId: "123456",
              fromCurrency: "btc",
              toCurrency: "eth",
              amountSend: "1.000001",
              amountReceive: "20.000001",
              networkFee: "0.000001",
              updatedAt: "2017-11-29T19:17:55.130Z"
            }

             */
            else {

                const {status} = data;

                Object.assign($scope.orderResult, data);

                if (statuses.new === status) {

                    $scope.orderResult.progress.bar = getProgressBarArr(1, 5);

                } else if (statuses.waiting === status) {

                    $scope.orderResult.progress.bar = getProgressBarArr(2, 5);


                } else if (statuses.confirming === status) {

                    $scope.orderResult.progress.bar = getProgressBarArr(3, 5);

                } else if (statuses.exchanging === status) {

                    $scope.orderResult.progress.bar = getProgressBarArr(3, 5);
                } else if (statuses.sending === status) {

                    $scope.orderResult.progress.bar = getProgressBarArr(4, 5);

                } else if (statuses.finished === status) {

                    $interval.cancel($scope.progressCheck);
                    $scope.orderResult.progress.bar = getProgressBarArr(5, 5);


                    let url = `tx hash: ${$scope.orderResult.hash}`;


                    if (ethCoins.includes($scope.orderResult.toCurrency.toUpperCase())) {

                        url = ajaxReq.blockExplorerTX.replace("[[txHash]]", $scope.orderResult.hash);

                    } else if ($scope.orderResult.toCurrency.toUpperCase() === 'BTC') {


                        url = bitcoinExplorer.replace('[[txHash]]', $scope.orderResult.hash);
                    }


                    const bExStr = "<a href='" + url + "' target='_blank' rel='noopener'> View your transaction </a>";


                    $scope.notifier.success(globalFuncs.successMsgs[2] + $scope.orderResult.hash + "<br />" + bExStr);


                } else if ([statuses.failed, statuses.refunded, statuses.expired].includes(status)) {
                    $interval.cancel($scope.progressCheck);
                    $scope.orderResult.progress.bar = getProgressBarArr(-1, 5);
                    $scope.notifier.danger('Order Status:' + '<br />' + status, 0);
                }

                $scope.saveOrderToStorage($scope.orderResult);

            }

        }


    }


    $scope.coinOrder = function coinOrder(a, b) {


        function weight(coin) {

            if (popularCoins.indexOf(coin.ticker.toUpperCase()) > -1) {


                coin.weight = 100 - popularCoins.indexOf(coin.ticker.toUpperCase());


            } else {

                coin.weight = 0;
            }

            return coin;
        }

        a = weight(a);

        b = weight(b);

        return b.weight - a.weight;


    }

    $scope.openOrder = async function () {


        if (verifyToAddress()) {


            const order = {
                amount: $scope.swapOrder.fromVal,
                from: $scope.swapOrder.fromCoin,
                to: $scope.swapOrder.toCoin,
                address: $scope.swapOrder.toAddress
            };


            const orderResult = await $scope.changeNow.openOrder(order);


            if (orderResult) {

                $scope.stage = 3;

                Object.assign($scope.orderResult, {
                    status: 'new',
                    fromCurrency: order.from,
                    toCurrency: order.to,
                    expectedSendAmount: order.amount,
                    progress: {
                        status: 'new',
                        bar: getProgressBarArr(0, 5),
                    }
                }, orderResult);

                await $scope.processOrder();
            } else {

                $scope.notifier.danger('Error opening order');
            }
        }
    };


    $scope.newSwap = function () {

        $interval.cancel($scope.progressCheck);

        $scope.saveOrderToStorage('');

        initValues();


        $scope.initChangeNow().then(() => {

            return $scope.setOrderCoin(false, 'btc');
        });

    }


    async function main() {


        if (isStorageOrderExists()) {

            $scope.stage = 3;
            setOrderFromStorage();
            await $scope.processOrder();


        } else {

            initValues();
            await $scope.initChangeNow();

            const isFrom = false;
            await $scope.setOrderCoin(isFrom, 'btc');
        }


    }

    main().finally(() => {

    });
};
module.exports = swapCtrl;
