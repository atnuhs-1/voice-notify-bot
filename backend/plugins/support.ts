import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

// Fastifyインスタンスの拡張型定義
declare module 'fastify' {
  interface FastifyInstance {
    someSupport(): string
  }
}

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope
const support: FastifyPluginAsync = async function (fastify, opts) {
  fastify.decorate('someSupport', function () {
    return 'hugs'
  })
}

export default fp(support, {
  name: 'support',
  dependencies: [] // 他のプラグインに依存しない場合は空
})