import * as React from 'react'
import { SWRConfig } from 'swr'
import { useRouter } from 'next/router'
import styles from '../styles/game.module.css'
import { formatEther, parseEther } from 'viem';
import { CONTRACT_ADDRESS, RED_TEAM_NUMBER, GRID_SIZE } from '../constants/utils'
import abi from '../constants/abi.json'
import { ContentBox } from '../components/contentBox'

import { FooterButtons } from '../components/footerButtons';
import { Button } from '../components/button';
import { GetStaticProps } from 'next';
import { useAccount, useContractRead } from 'wagmi';
import { useCallback, useMemo, useState } from 'react';
import { GameBoard } from '../components/gameBoard';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { usePrepareContractWrite, useContractWrite } from 'wagmi'
import { useGameData } from '../hooks/useGameData';
import { GameData, handleGameDataRequest } from './api/game';

type StagedCellKey = `${number}-${number}`
type StagedCellMapping = { [key: StagedCellKey]: boolean }
const stagedCellKey = (x: number, y: number) => `${x}-${y}` as StagedCellKey
const gamePrice = (stagedChanges: number) => parseEther('0.001') * (BigInt(stagedChanges))

function GamePage() {
    const { data: gameData } = useGameData();
    const router = useRouter();
    const { address, isDisconnected } = useAccount()
    const { openConnectModal } = useConnectModal();
    const { data: playerTeam } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: 'playerTeam',
        args: [address]
    })
    const [stagedCells, setStagedCells] = useState<StagedCellMapping>({})
    const numStagedChanges = useMemo(() => Object.keys(stagedCells).filter((k) => !!stagedCells[k as StagedCellKey]).length, [stagedCells]);
    const stagedCellsArgs = useMemo(() => {
        return Object.keys(stagedCells).filter((k) => !!stagedCells[k as StagedCellKey]).map((k) => {
            const [x, y] = k.split('-').map((n) => parseInt(n))
            return [x, y]
        })
    }, [stagedCells])
    const { config, error } = usePrepareContractWrite({
        address: CONTRACT_ADDRESS,
        abi: abi,
        functionName: 'injectCells',
        value: gamePrice(numStagedChanges),
        args: [stagedCellsArgs]
    })
    const { isLoading, isSuccess, write } = useContractWrite(config)
    const { data: playerContributions } = useContractRead({ address: CONTRACT_ADDRESS, abi, functionName: 'playerContributions', args: [address, gameData.currentGame] })

    const contributionPercentage = useMemo(() => {
        if (playerContributions && playerTeam) {
            return playerTeam === RED_TEAM_NUMBER ? (parseInt(playerContributions.toString()) / (parseInt(gameData.redContributions)) * 100) : (parseInt(playerContributions.toString()) / (parseInt(gameData.blueContributions)) * 100)
        } else {
            return null
        }
    }, [playerContributions])

    const tie = BigInt(gameData.blueScore) === BigInt(gameData.redScore);
    const teamBlueWinning = BigInt(gameData.blueScore) > BigInt(gameData.redScore);

    const onCellClick = useCallback((x: number, y: number) => {
        if (!playerTeam || gameData.grid[x][y] !== 0) { return }
        setStagedCells({ ...stagedCells, [stagedCellKey(x, y)]: !stagedCells[stagedCellKey(x, y)] })
    }, [stagedCells, setStagedCells, playerTeam])

    // Mutate grid value to include staged cells
    const stagedGrid = useMemo(() => {
        let ret = JSON.parse(JSON.stringify(gameData.grid));
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (stagedCells[stagedCellKey(x, y)]) {
                    // We will use 3 and 4 to denote the staged cells, so a staged cell for team 1 will be 3, and a staged cell for team 2 will be 4
                    ret[x][y] = (playerTeam as number) + 2;
                } else {
                    ret[x][y] = gameData.grid[x][y]
                }
            }
        }
        return ret;
    }, [stagedCells, playerTeam])


    const PrimaryButton = () => {
        if (isDisconnected) {
            return <Button onClick={() => openConnectModal && openConnectModal()}>Connect Wallet</Button>
        } else if (!playerTeam) {
            return <Button onClick={() => { router.push('/join') }}>Join Team</Button>
        } else if (isLoading) {
            return <Button onClick={() => { }}>Confirm in Wallet</Button>
        } else if (isSuccess) {
            return <Button onClick={() => { }}>Success!</Button>
        } else {
            return <Button onClick={() => { write && write() }}>Place {numStagedChanges} {parseInt(playerTeam as string) === RED_TEAM_NUMBER ? 'RED' : 'BLUE'} cells</Button>
        }
    }

    return (
        <>
            <div className={`${styles.pageContainer}`}>
                <GameBoard grid={stagedGrid} cellClickCB={onCellClick} />
                <div>
                    <ContentBox>
                        <h1>CELLULAR ENERGY</h1>
                        <p>
                            This is game <b>{gameData.currentGame}</b>, round <b>{gameData.currentRound}</b> of <b>96</b>.<br />
                            <span className="blue"><b>Team Blue</b></span>&nbsp;{!tie && teamBlueWinning ? 'is currently winning with ' : 'currently has '} <b>{gameData.blueScore} points</b>.<br />
                            <span className="red"><b>Team Red</b></span>&nbsp;{!tie && !teamBlueWinning ? 'is currently winning with ' : 'currently has'} <b>{gameData.redScore} points</b>.<br />
                        </p>
                        {parseInt(gameData.roundEnd) < (Date.now() / 1000) ? (
                            <p><b>The board is currently evolving.</b></p>
                        ) : (
                            <p>The next evolution will occur at <b>{formatTime(parseInt(gameData.roundEnd))}</b>.</p>
                        )}
                        <p>
                            Place a cell on the grid by clicking on an empty space. <br />
                            If it survives the next evolution, your team will earn a point.
                        </p>
                        <p>
                            The current prize pool is <b>{formatEther(BigInt(gameData.prizePool))} ETH</b>.
                            {contributionPercentage && (
                                <><br />You've contributed <b>{contributionPercentage}%</b> to your team's prize pool.</>
                            )}
                        </p>
                    </ContentBox>
                    <FooterButtons>
                        <PrimaryButton />
                        <Button onClick={() => { router.push('/how-to-play') }}>How to Play</Button>
                    </FooterButtons>
                </div>
            </div >
        </>
    )
}

const formatTime = (timestamp: number): string => {
    // Convert the timestamp to milliseconds
    const date = new Date(timestamp * 1000);

    // Extract hours, minutes, and AM/PM
    let hours = date.getHours();
    const minutes = ("0" + date.getMinutes()).slice(-2); // Ensure 2 digits
    const ampm = hours >= 12 ? 'pm' : 'am';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    return hours + ':' + minutes + ampm;
}

export default function Page({ fallback }: { [key: string]: GameData }) {
    return (
        <SWRConfig value={{ fallback }}>
            <GamePage />
        </SWRConfig>
    )
}

export const getStaticProps: GetStaticProps<{ fallback: ({ [key: string]: GameData }) }> = async () => {
    const gameData = await handleGameDataRequest()

    return {
        props: {
            fallback: {
                '/api/game': gameData
            }
        },
        revalidate: 1
    }
}
