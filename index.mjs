// Copyright 2021 Google LLC
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { existsSync } from "fs"
import { exec, execSync } from "child_process"
import { promisify } from "util"
import { createInterface } from "readline"
import { default as nodeFetch } from 'node-fetch'
import chalk from 'chalk'

export {chalk}

function colorize(cmd) {
  return cmd.replace(/^\w+\s/, substr => {
    return chalk.greenBright(substr)
  })
}

export function $(pieces, ...args) {
  let __from = (new Error().stack.split('at ')[2]).trim()
  let cmd = pieces[0], i = 0
  for (; i < args.length; i++) {
    cmd += args[i] + pieces[i + 1]
  }
  for (++i; i < pieces.length; i++) {
    cmd = pieces[i]
  }

  if ($.verbose) {
    console.log('$', colorize(cmd))
  }

  return new Promise((resolve, reject) => {
    let options = {
      windowsHide: true,
    }
    if (typeof $.shell != 'undefined') {
      options.shell = $.shell
    }
    if (typeof $.cwd !== 'undefined') {
      options.cwd = $.cwd
    }
    let child = exec(cmd, options), stdout = '', stderr = '', combined = ''
    child.stdout.on('data', data => {
      if ($.verbose) {
        process.stdout.write(data)
      }
      stdout += data
      combined += data
    })
    child.stderr.on('data', data => {
      if ($.verbose) {
        process.stderr.write(data)
      }
      stderr += data
      combined += data
    })
    child.on('exit', code => {
      (code === 0 ? resolve : reject)(
        new ProcessOutput({code,  stdout, stderr, combined, __from})
      )
    })
  })
}

$.verbose = true
$.shell = undefined
$.cwd = undefined

export function cd(path) {
  if ($.verbose) {
    console.log('$', colorize(`cd ${path}`))
  }
  if (!existsSync(path)) {
    let __from = (new Error().stack.split('at ')[2]).trim()
    console.error(`cd: ${path}: No such directory`)
    console.error(` at ${__from}`)
    process.exit(1)
  }
  $.cwd = path
}

export function test(cmd) {
  if ($.verbose) {
    console.log('$', colorize(`test ${cmd}`))
  }
  try {
    execSync(`test ${cmd}`)
    return true
  } catch (e) {
    return false
  }
}

export async function question(query, options) {
  let completer = undefined
  if (Array.isArray(options?.choices)) {
    completer = function completer(line) {
      const completions = options.choices
      const hits = completions.filter(c => c.startsWith(line))
      return [hits.length ? hits : completions, line]
    }
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  })
  const question = promisify(rl.question).bind(rl)
  let answer = await question(query)
  rl.close()
  return answer
}

export async function fetch(url, init) {
  if ($.verbose) {
    if (typeof init != 'undefined') {
      console.log('$', colorize(`fetch ${url}`), init)
    } else {
      console.log('$', colorize(`fetch ${url}`))
    }
  }
  return nodeFetch(url, init)
}

export class ProcessOutput {
  #code = 0
  #stdout = ''
  #stderr = ''
  #combined = ''
  #__from = ''

  constructor({code, stdout, stderr, combined, __from}) {
    this.#code = code
    this.#stdout = stdout
    this.#stderr = stderr
    this.#combined = combined
    this.#__from = __from
  }

  toString() {
    return this.#combined.replace(/\n$/, '')
  }

  get stdout() {
    return this.#stdout.replace(/\n$/, '')
  }

  get stderr() {
    return this.#stderr.replace(/\n$/, '')
  }

  get exitCode() {
    return this.#code
  }

  get __from() {
    return this.#__from
  }
}