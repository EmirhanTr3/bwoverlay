import fs from "fs";
import { logFilePath, hypixelApiKey, debug as debugVal, quitLevel } from "./config.json"
import { table } from "table";

if (!fs.existsSync(logFilePath)) {
    console.log("Log file at specified path does not exist.")
    process.exit(1)
}

if (hypixelApiKey == "ENTER YOUR HYPIXEL API KEY HERE") {
    console.log("Enter your hypixel api key in src/config.json")
    process.exit(1)
}

console.log("Started listening to log file at:", logFilePath)

function debug(message: any) {
    if (debugVal) {
        console.log(message)
    }
}

fs.watchFile(logFilePath, { interval: 1 }, async (curr, prev) => {
    const file = fs.readFileSync(logFilePath, { encoding: "utf-8" })
    const lines = file.split("\n")
    const line = lines[lines.length - 2]

    debug(line)

    if (!line.includes("[CHAT] ONLINE:")) return;

    const players = line.replace(/\[.*:.*:.*\] \[Render thread\/INFO\]: \[CHAT\] ONLINE: /, "").replace("\r", "").split(", ")
    debug(players)

    const playerChunks: string[][] = []
    for (let i = 0; i < players.length; i += 10) {
        const chunk = players.slice(i, i + 10)
        playerChunks.push(chunk)
    }

    const mojangPlayers: {id: string, name: string}[] = []
    
    for (const chunk of playerChunks) {
        const mojangResponse = await (await fetch("https://api.minecraftservices.com/minecraft/profile/lookup/bulk/byname", {
            method: "POST",
            body: JSON.stringify(chunk),
            headers: {
                "content-type": "application/json"
            }
        })).json()

        for (const player of mojangResponse) {
            mojangPlayers.push(player)
        }
    }

    debug(mojangPlayers)

    const data: any[][] = [
        ["Name", "NW Level", "BW Level", "Winstreak", "Final KDR", "WLR", "Final Kills", "Wins", "Bed Breaks"]
    ]

    for (const player of mojangPlayers) {
        const hypixelData = (await (await fetch("https://api.hypixel.net/v2/player?uuid=" + player.id, {
            headers: {
                "API-Key": hypixelApiKey
            }
        })).json()).player

        const name: string = hypixelData.displayname
        const rank: string = hypixelData.monthlyPackageRank == "SUPERSTAR" ? "MVP++" : hypixelData.newPackageRank ? hypixelData.newPackageRank.replace("_PLUS", "+") : "DEFAULT"
        const nwExp: number = hypixelData.networkExp
        const nwLevel: number = nwExp < 0 ? 1 : Math.floor(1 + -3.5 + Math.sqrt((-3.5 * -3.5) + (2 / 2_500) * nwExp))
        const level: number = hypixelData.achievements.bedwars_level
        const winstreak: number = hypixelData.stats.Bedwars.winstreak
        const fkdr: number = hypixelData.stats.Bedwars.final_kills_bedwars / hypixelData.stats.Bedwars.final_deaths_bedwars
        const wlr: number = hypixelData.stats.Bedwars.wins_bedwars / hypixelData.stats.Bedwars.losses_bedwars
        const finalKills: number = hypixelData.stats.Bedwars.final_kills_bedwars
        const wins: number = hypixelData.stats.Bedwars.wins_bedwars
        const bedBreak: number = hypixelData.stats.Bedwars.beds_broken_bedwars

        data.push([
            level >= quitLevel ? "\x1b[31m"+ rank + " " + name +"\x1b[0m" : rank + " " + name,
            nwLevel,
            level,
            winstreak,
            fkdr.toFixed(2),
            wlr.toFixed(2),
            finalKills,
            wins,
            bedBreak
        ])
    }
    
    console.log(table(data))
})