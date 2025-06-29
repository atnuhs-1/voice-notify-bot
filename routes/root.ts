import { FastifyPluginAsync } from 'fastify'

const root: FastifyPluginAsync = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return 'root endpoint'
  })
}

export default root