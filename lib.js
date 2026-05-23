async function connectSerial (onread = text => {}, ondisconnect = () => {}, baudRate = 115200, dataBits = 8, flowControl = "none", parity = "none", stopBits = 1) {
    let port = null
    try {
        port = await navigator.serial.requestPort()
        await port.open({baudRate, bufferSize: 255, dataBits, flowControl, parity, stopBits})
    } catch (er) {
        return null
    }
    let reader = port.readable.getReader()
    let writer = port.writable.getWriter()

    let comm = {
        data: {
            port,
            reader, writer,
            readDecoder: new TextDecoder(), writeEncoder: new TextEncoder(),
            readListenerLoop: null,
            hasDisconnected: false,
        },

        disconnect: async function () {
            if (!comm.data.hasDisconnected) {
                comm.data.hasDisconnected = true

                comm.data.reader.cancel()
                comm.data.reader.releaseLock()
                comm.data.writer.releaseLock()

                await comm.data.port.forget()
                ondisconnect()
            }
        },
        write: async function (text) {
            let arr = comm.data.writeEncoder.encode(`${text}`)
            await comm.data.writer.write(arr)
        },

        getInfo: function () {
            let info = comm.data.port.getInfo()
            return {usbVendorId: info.usbVendorId, usbProductId: info.usbProductId, btServiceClassId: info.bluetoothServiceClassId}
        },
        sendBreak: async function (ms) {
            await comm.data.port.setSignals({break: true})
            await new Promise(resolve => setTimeout(resolve, ms))
            if (!comm.data.hasDisconnected) await comm.data.port.setSignals({break: false})
        },
    }
    port.ondisconnect = async () => await comm.disconnect()
    
    comm.data.readListenerLoop = (async function () {
        while (!comm.data.hasDisconnected) {
            let {value, done} = await comm.data.reader.read()
            if (!done) onread(comm.data.readDecoder.decode(value))
            else break
        }
    })()
    return comm
}
