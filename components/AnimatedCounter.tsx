"use client"

import CountUp from "react-countup"

const AnimatedCounter = ({ amount }: { amount: number }) => {
    return (
        <p>
            <CountUp
                end={amount}
                decimal=","
                prefix="$"
                duration={2.75}
                decimals={2}

            />



        </p>
    )
}

export default AnimatedCounter