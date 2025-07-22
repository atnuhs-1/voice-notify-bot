import { FastifyPluginAsync } from 'fastify'

const example: FastifyPluginAsync = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return 'this is an example'
  })
}

export default example