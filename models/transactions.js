'use strict';
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const TransactionSchema =  mongoose.Schema({
    transdate: {type: String, required: true},
    description: {type: String, required: true},
    debit: {type: Number},
    credit: {type: Number},
    balance: {type: Number, required: true},
    category: {type: String, default: null},
});


TransactionSchema.methods.serialize = function() {
    return {
        transdate: this.transdate|| '',
        description: this.description || '',
        debit: this.debit || '',
        credit: this.credit || '',
        balance: this.balance || '',
        category: this.category || '',
    };
};

TransactionSchema.methods.processTransaction = function(data) {
    // maybe process the data?
    // return xyz
};

TransactionSchema.methods.addCategory = function(Transaction, category) {
    //inputs: where category is the new string to be given to a transaction 
    // - this MUST already be a created category
    // maybe process the data?
    // return xyz
};


// const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = TransactionSchema;



