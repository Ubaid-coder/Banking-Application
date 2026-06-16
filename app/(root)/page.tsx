import HeaderBox from '@/components/HeaderBox'
import RigthSidebar from '@/components/RigthSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import React from 'react'

const Home = () => {
  const loggedIn = { firstName: "Muhammad", lastName: "Ubaid", email: "ubaid@gamil.com" };
  return (
    <section className='home'>
      <div className='home-content'>
        <header className='home-header'>
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.firstName || 'Guest'}
            subtext="Access and manage your account and transactions efficiently."
          />
          <TotalBalanceBox
            accounts={[]}
            totalBanks={1}
            totalCurrentBalance={1000000}
          />
        </header>

        RECENT TRANSACTION
      </div>

      <RigthSidebar
        user={loggedIn}
        transactions={[]}
        banks={[{ currentBalance: 123.50 }, {currentBalance:500}]}
      />
    </section>
  )
}

export default Home