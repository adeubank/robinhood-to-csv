const fs = require('fs')
const converter = require('json-2-csv')
const prompt = require('prompt')
prompt.message = prompt.delimeter = ''

const API = require('./api')
const api = new API
const utils = require('./utils')

const nextOrders = (orders, cursor, resolve) => {
  // No more pages. Resolve and return.
  if (cursor === null) { return resolve(orders) }

  api.orders(cursor).then((response) => {
    nextOrders(orders.concat(response.results), response.next, resolve)
  })
}

module.exports = {
  login: ({ username, password } = {}) => {
    return new Promise((resolve) => {
      prompt.override = { username, password }

      const properties = {
        username: { default: process.env.ROBINHOOD_USERNAME, required: true },
        password: { default: process.env.ROBINHOOD_PASSWORD, required: true, hidden: true }
      }

      const handleResponse = (_err, res) => {
        resolve(api.login(res))
      }

      prompt.start()
      prompt.get({ properties }, handleResponse)
    })
  },

  getOrders: () => {
    return new Promise((resolve) => {
      nextOrders([], '', resolve)
    })
  },

  getSymbols: (orders) => {
    return Promise.all(
      orders.map(order =>
        api.instrument(utils.pluckLastOfPath(order.instrument))
          .then(({ symbol }) => Object.assign({}, order, { symbol }))
      )
    )
  },

  getExecutions: (orders) => {
    return orders.reduce((e, order) =>
      e.concat(order.executions.map(execution =>
        ({
          symbol: order.symbol,
          shares: execution.quantity,
          price: utils.formatCurrency(execution.price),
          transaction_type: order.side,
          commission: utils.formatCurrency(order.fees),
          date_executed: execution.timestamp
        })
      )), [])
  },

  convertToCsv: (transactions) => {
    return new Promise((resolve, reject) =>
      converter.json2csv(transactions, (err, csv) => {
        if (err) {
          reject(err)
        } else {
          resolve(csv)
        }
      })
    )
  },

  printCsv: (content, destination) => {
    if (destination === undefined) {
      console.log(content) // eslint-disable-line no-console
    } else {
      fs.writeFileSync(destination, content, 'utf8')
    }
  }
}
