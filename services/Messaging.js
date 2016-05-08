import Rascal from 'rascal'
import { format } from 'util'
import _ from 'lodash'
const chance = new require('chance')()

export class Messaging {

  constructor (config) {
    this.config = config
  }

  start () {
    Rascal.Broker.create(Rascal.withDefaultConfig(this.config.rascal), (err, broker) => {
        if (err) this.bail(err)

        broker.on('error', function(err) {
            console.error(err.message)
        })

        _.each(broker.config.subscriptions, function(subscriptionConfig, subscriptionName) {

            var handler = require('./handlers/' + subscriptionConfig.handler)(broker)

            broker.subscribe(subscriptionName, function(err, subscription) {
                if (err) return bail(err)
                subscription
                    .on('message', function(message, content, ackOrNack) {
                        handler(content, function(err) {
                            if (!err) return ackOrNack()
                            ackOrNack(err, err.recoverable ? broker.config.recovery.deferred_retry
                                                           : broker.config.recovery.dead_letter)
                        })
                    }).on('content_invalid', function(err, message, content, ackOrNack) {
                        console.err(err.message)
                        ackOrNack(err, config.recovery.dead_letter)
                    }).on('retries_exceeded', function(err, message, content, ackOrNack) {
                        console.err(err.message)
                        ackOrNack(err, config.recovery.dead_letter)
                    }).on('error', function(err) {
                        console.log(err)
                    })
            })
        })

        // Simulate a web app handling user registrations
        setInterval(function() {
            var user = { username: chance.first() + '_' + chance.last() }
            var events = { 0: 'created', 1: 'updated', 2: 'deleted' }
            var event = events[Math.floor(Math.random() * 3)]
            var routingKey = format('registration_webapp.user.%s.%s', event, user.username)

            broker.publish('user_event', user, routingKey, function(err, publication) {
                if (err) return console.log(err.message)
                publication
                    .on('success', function() {
                        // confirmed
                    }).on('error', function(err) {
                        console.error(err.message)
                    })
            })
        }, 1000)

        process.on('SIGINT', function() {
            broker.shutdown(function() {
                process.exit()
            })
        })
    })
  }

  bail (err) {
    console.error(err)
    process.exit(1)
  }
}
